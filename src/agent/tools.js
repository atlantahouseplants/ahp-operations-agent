/**
 * Tool definitions for the Claude agent.
 *
 * These are passed to the Claude API as the `tools` parameter.
 * The names and input_schema properties must exactly match what the system prompt
 * instructs Claude to call. The executor in run-agent.js routes by tool name.
 *
 * Based on PDR Section 8 / Section 4 (detailed spec).
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'sheets_read_rows',
    description:
      "Read rows from a Google Sheet tab. Can filter by a column value and limit results. Returns matching rows as objects with their data and row numbers. Use filter_column + filter_value to look up a specific client or filter recent visits.",
    input_schema: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            "The sheet tab name (e.g., 'Client_Master_Data', 'Service_Log', 'Tasks', 'PROCUREMENT_MASTER')",
        },
        filter_column: {
          type: 'string',
          description: "Column header to filter on (e.g., 'Account_Name', 'Client')",
        },
        filter_value: {
          type: 'string',
          description: 'Value to match in the filter column (case-insensitive exact match)',
        },
        limit: {
          type: 'number',
          description: 'Max rows to return. Default 10.',
        },
        sort_by: {
          type: 'string',
          description: 'Column header to sort results by',
        },
        sort_order: {
          type: 'string',
          description: "'asc' or 'desc'. Default 'desc'",
          enum: ['asc', 'desc'],
        },
      },
      required: ['sheet_name'],
    },
  },
  {
    name: 'sheets_append_row',
    description:
      'Append a new row to a Google Sheet tab. Provide column headers as keys and cell values as values. Extra keys not matching a column header are ignored. Missing columns are left blank.',
    input_schema: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet tab name to append to',
        },
        values: {
          type: 'object',
          description:
            'Object with column headers as keys and cell values as string values',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['sheet_name', 'values'],
    },
  },
  {
    name: 'sheets_update_row',
    description:
      'Update specific cells in an existing row. You must know the row number (from a previous sheets_read_rows call). Only the columns you specify are changed.',
    input_schema: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet tab name',
        },
        row_number: {
          type: 'number',
          description:
            'The 1-based row number to update (row 1 = headers, row 2 = first data row)',
        },
        values: {
          type: 'object',
          description: 'Object with column headers as keys and new values',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['sheet_name', 'row_number', 'values'],
    },
  },
  {
    name: 'gmail_send',
    description:
      'Send an email from service@atlantahouseplants.com. Use for client recap emails and urgent alerts to Geoff.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body (plain text)',
        },
        from_name: {
          type: 'string',
          description: "Sender display name. Default: 'Atlanta Houseplants'",
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'drive_create_doc',
    description:
      'Create a Google Doc in a specific Drive folder. Use for creating new client setup documents or service summaries.',
    input_schema: {
      type: 'object',
      properties: {
        folder_id: {
          type: 'string',
          description: 'Google Drive folder ID to create the document in',
        },
        title: {
          type: 'string',
          description: 'Document title',
        },
        content: {
          type: 'string',
          description: 'Document body text',
        },
      },
      required: ['folder_id', 'title', 'content'],
    },
  },
];
