/**
 * Google API authentication.
 *
 * Two auth clients are exported:
 *
 * 1. `getServiceAccountAuth()` — Standard service account auth for Sheets and Drive.
 *    Access is granted by sharing resources with the service account email.
 *
 * 2. `getGmailAuth()` — JWT client with domain-wide delegation for Gmail.
 *    This impersonates the GOOGLE_WORKSPACE_USER so emails are sent from that address.
 *    Requires domain-wide delegation to be configured in Google Workspace Admin.
 *
 * The service account JSON key is stored in GOOGLE_SERVICE_ACCOUNT_KEY env var
 * as a stringified JSON object (no newlines in the env var value).
 */

import { GoogleAuth, JWT } from 'google-auth-library';

let _credentials = null;

function getCredentials() {
  if (_credentials) return _credentials;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw || raw === 'PLACEHOLDER') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  }
  try {
    _credentials = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }
  return _credentials;
}

/**
 * Returns a GoogleAuth client for Sheets and Drive.
 * Service account accesses resources that are shared with its email address.
 */
export function getServiceAccountAuth() {
  const credentials = getCredentials();
  return new GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

/**
 * Returns a JWT client for Gmail with domain-wide delegation.
 * Impersonates the GOOGLE_WORKSPACE_USER to send email from that address.
 */
export function getGmailAuth() {
  const credentials = getCredentials();
  const subject = process.env.GOOGLE_WORKSPACE_USER;
  if (!subject) {
    throw new Error('GOOGLE_WORKSPACE_USER is not configured');
  }
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject, // impersonate this workspace user
  });
}
