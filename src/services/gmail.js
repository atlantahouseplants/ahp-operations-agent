/**
 * Gmail API v1 wrapper.
 *
 * Sends emails from the GOOGLE_WORKSPACE_USER address using
 * domain-wide delegation (the service account impersonates that user).
 *
 * Prerequisite: domain-wide delegation must be configured in Google Workspace Admin
 * with scope https://www.googleapis.com/auth/gmail.send for this service account.
 */

import { google } from 'googleapis';
import { getGmailAuth } from '../lib/google-auth.js';

async function getGmailClient() {
  const auth = getGmailAuth();
  return google.gmail({ version: 'v1', auth });
}

/**
 * Encodes a string to base64url (URL-safe base64 without padding).
 * Required for Gmail API message encoding.
 */
function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email from the configured workspace address.
 *
 * @param {string} to         - Recipient email
 * @param {string} subject    - Subject line
 * @param {string} body       - Plain text body
 * @param {string} fromName   - Display name (default: 'Atlanta Houseplants')
 * @returns {{ success, message_id, to }}
 */
export async function sendEmail(to, subject, body, fromName = 'Atlanta Houseplants') {
  const gmail = await getGmailClient();
  const sender = process.env.GOOGLE_WORKSPACE_USER;

  // Build RFC 2822 MIME message
  const messageParts = [
    `From: ${fromName} <${sender}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
    '',
    body,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = toBase64Url(rawMessage);

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });

  return {
    success: true,
    message_id: res.data.id,
    to,
  };
}
