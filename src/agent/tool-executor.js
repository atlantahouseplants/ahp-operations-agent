/**
 * Tool executor — routes Claude's tool_use calls to the correct Google API wrapper.
 *
 * Each case wraps the underlying call in try/catch so errors are returned as
 * { error: message } objects rather than thrown. This lets Claude see what
 * failed and decide whether to retry or move on.
 */

import * as googleSheets from '../services/google-sheets.js';
import * as gmail from '../services/gmail.js';
import * as googleDrive from '../services/google-drive.js';

/**
 * Executes a named tool with the given input from Claude.
 *
 * @param {string} toolName  — The tool name from Claude's tool_use block
 * @param {object} toolInput — The input parameters from Claude
 * @returns {Promise<object>} Result to send back as tool_result
 */
export async function executeTool(toolName, toolInput) {
  switch (toolName) {
    case 'sheets_read_rows': {
      const { sheet_name, filter_column, filter_value, limit, sort_by, sort_order } = toolInput;
      return await googleSheets.readRows(sheet_name, {
        filter_column,
        filter_value,
        limit,
        sort_by,
        sort_order,
      });
    }

    case 'sheets_append_row': {
      const { sheet_name, values } = toolInput;
      return await googleSheets.appendRow(sheet_name, values);
    }

    case 'sheets_update_row': {
      const { sheet_name, row_number, values } = toolInput;
      return await googleSheets.updateRow(sheet_name, row_number, values);
    }

    case 'gmail_send': {
      const { to, subject, body, from_name } = toolInput;
      return await gmail.sendEmail(to, subject, body, from_name);
    }

    case 'drive_create_doc': {
      const { folder_id, title, content } = toolInput;
      return await googleDrive.createDoc(folder_id, title, content);
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
