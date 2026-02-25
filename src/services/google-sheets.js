/**
 * Google Sheets API v4 wrapper.
 *
 * Three operations:
 *   readRows(sheetName, options)    — read rows, optionally filtered
 *   appendRow(sheetName, values)   — add a new row
 *   updateRow(sheetName, row, values) — update cells in an existing row
 *
 * Headers are cached per sheet name to avoid re-reading row 1 on every call.
 * The spreadsheet ID is resolved per sheet name (PROCUREMENT_MASTER uses its own).
 */

import { google } from 'googleapis';
import { getServiceAccountAuth } from '../lib/google-auth.js';
import { getSpreadsheetId } from '../config/sheets-config.js';

// Header cache: sheetName → array of column header strings
const headerCache = new Map();

async function getSheetsClient() {
  const auth = getServiceAccountAuth();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Reads and caches the header row (row 1) for a sheet.
 * Returns an array of header strings.
 */
async function getHeaders(sheets, spreadsheetId, sheetName) {
  const cacheKey = `${spreadsheetId}::${sheetName}`;
  if (headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headers = (res.data.values?.[0] || []).map(String);
  headerCache.set(cacheKey, headers);
  return headers;
}

/**
 * Converts a column index (0-based) to A1 notation letter(s).
 * 0 → A, 25 → Z, 26 → AA, etc.
 */
function colIndexToLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Reads rows from a sheet with optional filtering and limiting.
 *
 * @param {string} sheetName
 * @param {object} options
 *   filter_column  — column header to filter on
 *   filter_value   — value to match (case-insensitive)
 *   limit          — max rows to return (default 10)
 *   sort_by        — column header to sort by
 *   sort_order     — 'asc' | 'desc' (default 'desc')
 * @returns {{ rows, total_found, row_numbers }}
 */
export async function readRows(sheetName, options = {}) {
  const { filter_column, filter_value, limit = 10, sort_by, sort_order = 'desc' } = options;

  const spreadsheetId = getSpreadsheetId(sheetName);
  const sheets = await getSheetsClient();
  const headers = await getHeaders(sheets, spreadsheetId, sheetName);

  // Read all data rows
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:ZZ`,
  });

  const rawRows = res.data.values || [];

  // Convert to objects, tracking 1-based row numbers (row 1 = headers, row 2 = first data row)
  let rows = rawRows.map((row, i) => {
    const obj = {};
    headers.forEach((header, colIdx) => {
      obj[header] = row[colIdx] ?? '';
    });
    return { _rowNumber: i + 2, ...obj };
  });

  // Filter
  if (filter_column && filter_value !== undefined && filter_value !== null) {
    const filterVal = String(filter_value).toLowerCase();
    rows = rows.filter(
      (r) => String(r[filter_column] ?? '').toLowerCase() === filterVal
    );
  }

  // Sort
  if (sort_by) {
    rows.sort((a, b) => {
      const av = a[sort_by] ?? '';
      const bv = b[sort_by] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sort_order === 'asc' ? cmp : -cmp;
    });
  }

  const total_found = rows.length;
  const row_numbers = rows.map((r) => r._rowNumber);

  // Limit
  const limited = rows.slice(0, limit);

  // Strip internal _rowNumber from returned objects
  const cleanRows = limited.map(({ _rowNumber, ...rest }) => rest);
  const cleanRowNumbers = limited.map((r) => r._rowNumber);

  return {
    rows: cleanRows,
    total_found,
    row_numbers: cleanRowNumbers,
  };
}

/**
 * Appends a new row to a sheet.
 * Maps column header names to positions — extra columns in `values` are ignored.
 * Missing columns in `values` are left empty.
 *
 * @param {string} sheetName
 * @param {object} values — { ColumnHeader: value, ... }
 * @returns {{ success, row_number, sheet_name }}
 */
export async function appendRow(sheetName, values) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  const sheets = await getSheetsClient();
  const headers = await getHeaders(sheets, spreadsheetId, sheetName);

  // Build row array in header order
  const rowData = headers.map((header) => {
    const val = values[header];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowData] },
  });

  // Extract the row number from the updated range (e.g., "Service_Log!A47:Z47")
  const updatedRange = res.data.updates?.updatedRange || '';
  const rowMatch = updatedRange.match(/:?[A-Z]+(\d+)$/);
  const row_number = rowMatch ? parseInt(rowMatch[1], 10) : null;

  return { success: true, row_number, sheet_name: sheetName };
}

/**
 * Updates specific cells in an existing row.
 *
 * @param {string} sheetName
 * @param {number} rowNumber — 1-based row number
 * @param {object} values   — { ColumnHeader: newValue, ... }
 * @returns {{ success, row_number, updated_columns }}
 */
export async function updateRow(sheetName, rowNumber, values) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  const sheets = await getSheetsClient();
  const headers = await getHeaders(sheets, spreadsheetId, sheetName);

  const requests = [];
  const updated_columns = [];

  for (const [header, value] of Object.entries(values)) {
    const colIdx = headers.indexOf(header);
    if (colIdx === -1) continue; // unknown column — skip

    const colLetter = colIndexToLetter(colIdx);
    const range = `${sheetName}!${colLetter}${rowNumber}`;

    requests.push(
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[String(value ?? '')]] },
      })
    );
    updated_columns.push(header);
  }

  await Promise.all(requests);

  return { success: true, row_number: rowNumber, updated_columns };
}
