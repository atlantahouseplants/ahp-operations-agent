/**
 * AHP Operations Agent — Test Runner
 *
 * POSTs each fixture to the running endpoint and prints the full response.
 *
 * Usage:
 *   # Start local server first:
 *   npx vercel dev
 *
 *   # Run all fixtures (another terminal):
 *   node test/test-agent.js
 *
 *   # Run a specific fixture:
 *   node test/test-agent.js routine-visit
 *   node test/test-agent.js poor-health
 *
 * Environment: reads AHP_API_KEY from .env automatically.
 * API_BASE_URL defaults to http://localhost:3000
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env ────────────────────────────────────────────────────────────────

function loadEnv() {
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
  } catch {
    // .env not found — use existing env
  }
}

loadEnv();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.AHP_API_KEY || '';

const FIXTURES = [
  'routine-visit',
  'issues-visit',
  'standards-fail',
  'poor-health',
  'replacements-needed',
  'new-client',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(name) {
  return JSON.parse(readFileSync(resolve(__dirname, `fixtures/${name}.json`), 'utf8'));
}

async function testHealth() {
  console.log('\n─── Health Check ───────────────────────────────────────────');
  const res = await fetch(`${BASE_URL}/api/health`);
  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  return res.status === 200;
}

async function testAuthRejection() {
  console.log('\n─── Auth Rejection (wrong key) ─────────────────────────────');
  const fixture = loadFixture('routine-visit');
  const res = await fetch(`${BASE_URL}/api/process-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'wrong-key-12345' },
    body: JSON.stringify(fixture),
  });
  const data = await res.json();
  console.log(`Status: ${res.status} (expected 401)`);
  console.log(JSON.stringify(data, null, 2));
  return res.status === 401;
}

async function testValidationRejection() {
  console.log('\n─── Validation Rejection (missing form_data) ───────────────');
  const res = await fetch(`${BASE_URL}/api/process-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  console.log(`Status: ${res.status} (expected 400)`);
  console.log(JSON.stringify(data, null, 2));
  return res.status === 400;
}

async function testFixture(fixtureName) {
  const bar = '─'.repeat(Math.max(0, 50 - fixtureName.length));
  console.log(`\n─── Fixture: ${fixtureName} ${bar}`);

  const payload = loadFixture(fixtureName);
  const client = payload.form_data['Select Client Account'];
  const isNew = payload.form_data['Is New Client'];
  const health = payload.form_data['Overall Account Plant Health'];
  const standards = payload.form_data['Is This Account Up To AHP Standards?'];

  console.log(`Client:    ${client}${isNew ? ' (NEW)' : ''}`);
  console.log(`Health:    ${health}`);
  console.log(`Standards: ${standards}`);
  console.log(`Sending to ${BASE_URL}/api/process-visit ...`);

  const start = Date.now();
  let res, data;

  try {
    res = await fetch(`${BASE_URL}/api/process-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch (err) {
    console.error(`❌ Request failed: ${err.message}`);
    return false;
  }

  const elapsed = Date.now() - start;
  console.log(`\nResponse: ${res.status} (${elapsed}ms)`);

  if (!data.success) {
    console.error(`❌ Failed: ${data.error}`);
    return false;
  }

  // Print agent summary
  console.log(`\n🧠 Agent Summary:\n${data.summary}`);

  // Print tool calls
  const actions = data.actions_taken || [];
  if (actions.length > 0) {
    console.log(`\n🔧 Tool Calls (${actions.length}):`);
    actions.forEach((a, i) => {
      const inputPreview = JSON.stringify(a.input).slice(0, 100);
      const resultPreview = a.error
        ? `ERROR: ${a.error}`
        : JSON.stringify(a.result).slice(0, 80);
      console.log(`  ${i + 1}. ${a.tool}`);
      console.log(`     in:  ${inputPreview}`);
      console.log(`     out: ${resultPreview}`);
    });
  }

  if (data.meta) {
    console.log(`\n📊 Meta: ${data.meta.iterations} iterations, ${elapsed}ms`);
  }

  console.log('\n✅ Success');
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  AHP Operations Agent — Test Runner');
  console.log(`  ${BASE_URL}`);
  console.log(`  API Key: ${API_KEY ? API_KEY.slice(0, 8) + '...' : '(not set)'}`);
  console.log(`${'═'.repeat(60)}`);

  const requestedFixture = process.argv[2];

  // Infrastructure checks
  const healthOk = await testHealth();
  if (!healthOk) {
    console.error('\n❌ Health check failed. Is the server running?');
    console.error('   Run: npx vercel dev\n');
    process.exit(1);
  }

  await testAuthRejection();
  await testValidationRejection();

  // Check for real credentials before running Claude tests
  const hasApiKey = API_KEY && !API_KEY.includes('PLACEHOLDER');
  const hasAnthropicKey = process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key';
  const hasGoogleKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY !== 'PLACEHOLDER';

  if (!hasApiKey || !hasAnthropicKey) {
    console.log('\n⚠️  Credentials not configured — skipping agent tests.');
    console.log('   Set AHP_API_KEY and ANTHROPIC_API_KEY in .env and re-run.\n');
    return;
  }

  if (!hasGoogleKey) {
    console.log('\n⚠️  GOOGLE_SERVICE_ACCOUNT_KEY not set — agent will fail on Sheets/Gmail calls.');
    console.log('   See README for Google Cloud setup instructions.\n');
    // Continue anyway — useful to see the agent attempt and fail gracefully
  }

  const fixtureList = requestedFixture ? [requestedFixture] : FIXTURES;
  const results = [];

  for (const name of fixtureList) {
    try {
      const ok = await testFixture(name);
      results.push({ name, ok });
    } catch (err) {
      console.error(`\n❌ ${name}: ${err.message}`);
      results.push({ name, ok: false });
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  const passed = results.filter((r) => r.ok).length;
  console.log(`Results: ${passed}/${results.length} passed`);
  results.forEach((r) => console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}`));
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
