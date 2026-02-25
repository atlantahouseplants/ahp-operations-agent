/**
 * Google API authentication — OAuth 2.0 with refresh token.
 *
 * Instead of a service account JSON key (blocked by org policy), this uses
 * an OAuth 2.0 client credential + refresh token obtained once via the
 * scripts/get-refresh-token.js setup script.
 *
 * The refresh token authorizes the agent to act as the Google Workspace user
 * (service@atlantahouseplants.com) directly — no domain-wide delegation needed.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — from GCP Console → OAuth 2.0 Client IDs
 *   GOOGLE_CLIENT_SECRET  — same credential
 *   GOOGLE_REFRESH_TOKEN  — obtained once via scripts/get-refresh-token.js
 */

import { OAuth2Client } from 'google-auth-library';

let _client = null;

/**
 * Returns a single shared OAuth2 client, initialized from env vars.
 * The client automatically refreshes the access token when it expires.
 */
export function getOAuthClient() {
  if (_client) return _client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || clientId === 'your-client-id') {
    throw new Error('GOOGLE_CLIENT_ID is not configured. Run scripts/get-refresh-token.js first.');
  }
  if (!clientSecret || clientSecret === 'your-client-secret') {
    throw new Error('GOOGLE_CLIENT_SECRET is not configured.');
  }
  if (!refreshToken || refreshToken === 'your-refresh-token') {
    throw new Error('GOOGLE_REFRESH_TOKEN is not configured. Run scripts/get-refresh-token.js first.');
  }

  _client = new OAuth2Client(clientId, clientSecret);
  _client.setCredentials({ refresh_token: refreshToken });

  return _client;
}

/**
 * Returns the same OAuth client for Sheets, Gmail, and Drive.
 * Since OAuth authorizes as the actual user, all three APIs work
 * without any special delegation setup.
 */
export function getServiceAccountAuth() {
  return getOAuthClient();
}

export function getGmailAuth() {
  return getOAuthClient();
}
