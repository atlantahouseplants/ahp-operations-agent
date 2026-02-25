/**
 * Google Drive API v3 wrapper.
 *
 * v1 only implements createDoc — used for future new client setup tasks.
 * The service account needs Editor access to the target folder.
 */

import { google } from 'googleapis';
import { getServiceAccountAuth } from '../lib/google-auth.js';

async function getDriveClient() {
  const auth = getServiceAccountAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Creates a plain text Google Doc in the specified Drive folder.
 *
 * Note: The Drive API creates files but doesn't write Google Docs content natively.
 * This creates a text/plain file — for a proper Google Doc with formatting,
 * the Docs API would be needed. For v1 this is sufficient.
 *
 * @param {string} folderId  - Google Drive folder ID
 * @param {string} title     - Document title
 * @param {string} content   - Document body text
 * @returns {{ success, doc_id, doc_url }}
 */
export async function createDoc(folderId, title, content) {
  const drive = await getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    },
    media: {
      mimeType: 'text/plain',
      body: content,
    },
    fields: 'id,webViewLink',
  });

  return {
    success: true,
    doc_id: res.data.id,
    doc_url: res.data.webViewLink,
  };
}
