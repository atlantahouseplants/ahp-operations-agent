/**
 * POST /api/process-visit
 *
 * Main entry point for the AHP Operations Agent.
 * The service form POSTs here after every visit.
 *
 * Flow:
 *   1. Handle CORS preflight (OPTIONS)
 *   2. Verify POST method
 *   3. Authenticate via x-api-key
 *   4. Validate request body
 *   5. Run the Claude agent
 *   6. Return { success, summary, actions_taken }
 *
 * NOTE: This function requires ~15–30 seconds to complete (8–15 tool calls).
 * Vercel Pro (maxDuration: 60) is required. Free tier (10s) will timeout.
 */

import { isAuthorized } from '../src/lib/auth.js';
import { validateRequest } from '../src/lib/validate.js';
import { runAgent } from '../src/agent/run-agent.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCors(res);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // Auth
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'AUTH_ERROR' });
  }

  // Validate
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      code: 'INVALID_REQUEST',
    });
  }

  const { form_data } = req.body;

  // Run the agent
  try {
    console.log(`[AHP] Processing visit for: ${form_data['Select Client Account']}`);
    const startTime = Date.now();

    const { summary, actions_taken, iteration_count } = await runAgent(form_data);

    const elapsed = Date.now() - startTime;
    console.log(`[AHP] Agent completed in ${elapsed}ms, ${iteration_count} iterations, ${actions_taken.length} tool calls`);

    return res.status(200).json({
      success: true,
      summary,
      actions_taken,
      meta: {
        iterations: iteration_count,
        elapsed_ms: elapsed,
        client: form_data['Select Client Account'],
      },
    });
  } catch (err) {
    console.error('[AHP] Agent error:', err.message, err.stack);
    return res.status(500).json({
      success: false,
      error: `Agent error: ${err.message}`,
      code: 'AGENT_ERROR',
    });
  }
}
