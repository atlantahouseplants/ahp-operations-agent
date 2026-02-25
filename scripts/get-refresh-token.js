/**
 * One-time script to get a Google OAuth refresh token.
 *
 * Run this ONCE locally to authorize the agent to access your Google account.
 * It will open a browser — click Allow — then paste the code back here.
 * The refresh token it prints gets stored in .env as GOOGLE_REFRESH_TOKEN.
 *
 * Usage:
 *   node scripts/get-refresh-token.js
 *
 * Requires in .env (or set inline below):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const contents = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  for (const line of contents.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eqIdx = t.indexOf('=');
    if (eqIdx < 1) continue;
    const key = t.slice(0, eqIdx).trim();
    const val = t.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found */ }

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || CLIENT_ID === 'your-client-id') {
  console.error('\n❌ GOOGLE_CLIENT_ID not set in .env');
  console.error('   Add it from: GCP Console → APIs & Services → Credentials\n');
  process.exit(1);
}

// Scopes needed by the agent
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Desktop app — copies code to clipboard

// Build the authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent'); // force refresh token even if already authorized

console.log('\n════════════════════════════════════════════════════════════');
console.log('  AHP Operations Agent — Google OAuth Setup');
console.log('════════════════════════════════════════════════════════════');
console.log('\n1. Open this URL in your browser (sign in as service@atlantahouseplants.com):');
console.log('\n' + authUrl.toString() + '\n');
console.log('2. Click Allow');
console.log('3. Copy the authorization code shown on screen');
console.log('════════════════════════════════════════════════════════════\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the authorization code here: ', async (code) => {
  rl.close();

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    console.error('No code entered. Exiting.');
    process.exit(1);
  }

  // Exchange code for tokens
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: trimmedCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const data = await res.json();

    if (data.error) {
      console.error('\n❌ Error exchanging code:', data.error, data.error_description);
      process.exit(1);
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅  SUCCESS — Add these to your .env file:');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('\nAlso add/confirm these are already in .env:');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log('\nThen add to Vercel dashboard as environment variables.');

    if (!data.refresh_token) {
      console.warn('\n⚠️  No refresh_token returned. This usually means you already authorized');
      console.warn('   this app before. Revoke access and re-run to get a fresh token:');
      console.warn('   https://myaccount.google.com/permissions');
    }

  } catch (err) {
    console.error('\n❌ Request failed:', err.message);
    process.exit(1);
  }
});
