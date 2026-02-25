/**
 * Webhook API key authentication.
 * The service form sends AHP_API_KEY in the x-api-key header.
 */

export function isAuthorized(req) {
  const provided = req.headers['x-api-key'];
  const expected = process.env.AHP_API_KEY;
  if (!expected || expected === 'PLACEHOLDER') return false;
  return provided === expected;
}
