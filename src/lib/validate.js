/**
 * Request body validation for /api/process-visit.
 * Validates that form_data has all required fields.
 */

export function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  if (!body.form_data || typeof body.form_data !== 'object') {
    return { valid: false, error: 'form_data is required and must be an object' };
  }

  const fd = body.form_data;

  const checks = [
    [!fd['Select Client Account']?.trim(), 'form_data["Select Client Account"] is required'],
    [!fd['Service Date'], 'form_data["Service Date"] is required'],
    [!Array.isArray(fd['Services Performed Today']) || fd['Services Performed Today'].length === 0,
      'form_data["Services Performed Today"] must be a non-empty array'],
    [!Array.isArray(fd['Any Issues or Concerns?']) || fd['Any Issues or Concerns?'].length === 0,
      'form_data["Any Issues or Concerns?"] must be a non-empty array'],
    [!fd['Overall Account Plant Health']?.trim(), 'form_data["Overall Account Plant Health"] is required'],
    [!fd['Is This Account Up To AHP Standards?']?.trim(), 'form_data["Is This Account Up To AHP Standards?"] is required'],
    [!fd['Service Notes & Details']?.trim(), 'form_data["Service Notes & Details"] is required'],
    [!fd['Completed by']?.trim(), 'form_data["Completed by"] is required'],
  ];

  for (const [fail, error] of checks) {
    if (fail) return { valid: false, error };
  }

  return { valid: true };
}
