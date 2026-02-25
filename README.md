# AHP Operations Agent

A Claude AI agent that runs as a Vercel serverless function. When Bri submits a service form, this agent:

1. Looks up the client's account data from Google Sheets
2. Reads their last 5 service visits for context
3. Analyzes the visit (health trends, issues, standards compliance)
4. Logs the visit to Service_Log sheet
5. Sends the client a recap email via Gmail
6. Creates tasks in the Tasks sheet if needed
7. Emails Geoff alerts for urgent issues
8. Parses and queues procurement items to PROCUREMENT_MASTER
9. Updates the client's record in Client_Master_Data

No Make.com. No middleware. One Claude agent loop using tool use.

---

## Architecture

```
Service Form → POST /api/process-visit → Claude Agent (8–15 tool calls) → Google Sheets, Gmail, Drive
```

---

## Google Cloud Setup

The agent uses **OAuth 2.0 with a refresh token** — no service account JSON key required (works even if your org blocks key creation).

### 1. Create project and enable APIs

1. Go to https://console.cloud.google.com
2. Create project: **"AHP Operations"**
3. Enable these APIs:
   - Google Sheets API
   - Gmail API
   - Google Drive API

### 2. Create an OAuth 2.0 Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. If prompted to configure the consent screen first:
   - User type: **Internal**
   - App name: `AHP Operations Agent`
   - Support email: your email → Save
3. Application type: **Desktop app** → Name: `AHP Agent` → Create
4. Note the **Client ID** and **Client Secret** (or download the JSON)

### 3. Run the one-time auth script

```bash
# Add Client ID and Secret to .env first, then:
node scripts/get-refresh-token.js
```

This opens a browser URL — sign in as `service@atlantahouseplants.com`, click Allow, paste the code back. The script prints your `GOOGLE_REFRESH_TOKEN`.

### 4. Share your Sheets with your Google account

The agent accesses Sheets as **you** (whoever authorized the OAuth flow), so your account already has access. No sharing needed if you own the spreadsheet.

### 5. Set environment variables

Add to `.env` and Vercel dashboard:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your `sk-ant-...` Anthropic key |
| `AHP_API_KEY` | Random secret — the service form sends this |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON key, stringified (no newlines) |
| `GOOGLE_WORKSPACE_USER` | `service@atlantahouseplants.com` |
| `SPREADSHEET_ID` | Google Sheets ID from the URL |
| `PROCUREMENT_SPREADSHEET_ID` | Procurement sheet ID (same as above if same file) |
| `GEOFF_EMAIL` | `geoff@atlantahouseplants.com` |
| `CLAUDE_MODEL` | `claude-sonnet-4-5-20250929` |
| `CLAUDE_MAX_TOKENS` | `4096` |

Generate an `AHP_API_KEY`:
```bash
node -e "console.log('ahp_' + require('crypto').randomBytes(20).toString('hex'))"
```

---

## Run Locally

```bash
npm install
npx vercel dev
```

Run tests in another terminal:

```bash
node test/test-agent.js              # all fixtures
node test/test-agent.js routine-visit  # one fixture
```

---

## Deploy to Vercel

> **⚠️ Vercel Pro required.** The agent takes 15–30 seconds to complete. Free tier has a 10s timeout. Pro ($20/mo) supports up to 60s.

### Option A — Vercel Dashboard

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → import `ahp-operations-agent`
3. Add all environment variables (see table above)
4. Click **Deploy**

### Option B — CLI

```bash
npx vercel login
npx vercel --prod
```

After deploy, set env vars in **Project → Settings → Environment Variables** and redeploy.

---

## Update the Service Form

After deployment, update the service form's webhook URL:

1. In Vercel dashboard for `ahp-service-form`
2. Change `VITE_WEBHOOK_URL` to: `https://ahp-operations-agent.vercel.app/api/process-visit`
3. Redeploy the form

---

## Update the AI Prompt

All agent behavior is controlled by one file:

```
src/prompts/agent-system.js
```

Edit the `AGENT_SYSTEM_PROMPT` string to change:
- When tasks are created and with what priority
- What client emails say
- When Geoff gets alerted
- How procurement items are routed to suppliers

Commit, push, and Vercel auto-deploys.

---

## Project Structure

```
ahp-operations-agent/
├── api/
│   ├── process-visit.js      ← Main endpoint (runs the agent)
│   └── health.js             ← Health check
├── src/
│   ├── agent/
│   │   ├── run-agent.js      ← Claude agent loop (tool use cycle)
│   │   ├── tool-executor.js  ← Routes tool calls to Google API wrappers
│   │   └── tools.js          ← Tool definitions for Claude
│   ├── prompts/
│   │   └── agent-system.js   ← System prompt (edit here to change behavior)
│   ├── services/
│   │   ├── google-sheets.js  ← Sheets read/append/update with header caching
│   │   ├── gmail.js          ← Gmail send via domain-wide delegation
│   │   └── google-drive.js   ← Drive doc creation
│   ├── lib/
│   │   ├── google-auth.js    ← Service account + JWT auth clients
│   │   ├── auth.js           ← x-api-key validation
│   │   └── validate.js       ← Request body validation
│   └── config/
│       └── sheets-config.js  ← Spreadsheet IDs and sheet name constants
└── test/
    ├── test-agent.js         ← End-to-end test runner
    └── fixtures/             ← 6 realistic test scenarios (form_data only)
```

---

## Cost

| Item | Monthly |
|------|---------|
| Claude API (~60 visits × $0.05–0.15) | ~$3–9 |
| Vercel Pro | $20 |
| Google APIs | Free |
| **Total** | **~$23–29** |

Replaces Make.com ($10.59/mo) + the previous Operations Brain API, with full observability and one codebase.
