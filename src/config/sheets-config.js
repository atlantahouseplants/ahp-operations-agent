/**
 * Google Sheets configuration.
 * Sheet names must match the actual tab names in the spreadsheet exactly.
 */

export const SHEETS_CONFIG = {
  // Main spreadsheet (Service Records, Client Master, Tasks, etc.)
  MAIN_SPREADSHEET_ID: process.env.SPREADSHEET_ID,

  // Procurement spreadsheet (may be on a different Shared Drive)
  PROCUREMENT_SPREADSHEET_ID:
    process.env.PROCUREMENT_SPREADSHEET_ID || process.env.SPREADSHEET_ID,

  // Sheet tab names — must match exactly
  SHEETS: {
    CLIENT_MASTER: 'Client_Master_Data',
    SERVICE_LOG: 'Service_Log',
    TASKS: 'Tasks',
    PROCUREMENT: 'PROCUREMENT_MASTER',
    MARKETING: 'Marketing_Queue',
    CONFIG: 'Config',
    INVOICES: 'Invoice_Tracker',
  },
};

/**
 * Returns the correct spreadsheet ID for a given sheet name.
 * PROCUREMENT_MASTER uses its own spreadsheet; everything else uses the main one.
 *
 * @param {string} sheetName
 * @returns {string} spreadsheet ID
 */
export function getSpreadsheetId(sheetName) {
  if (sheetName === SHEETS_CONFIG.SHEETS.PROCUREMENT) {
    return SHEETS_CONFIG.PROCUREMENT_SPREADSHEET_ID;
  }
  return SHEETS_CONFIG.MAIN_SPREADSHEET_ID;
}
