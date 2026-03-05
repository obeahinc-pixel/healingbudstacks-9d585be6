/**
 * Zero-Retention Privacy Middleware
 * 
 * Portable PII scrubbing utilities for logging.
 * Strips email, phone, and name fields before any payload is logged.
 */

const PII_KEYS = new Set([
  'email', 'phone', 'contactNumber', 'firstName', 'lastName',
  'full_name', 'fullName', 'customer_email', 'customer_name',
  'address1', 'address2', 'postalCode', 'zipCode',
]);

/**
 * Recursively scrub PII from an object for safe logging.
 * Returns a deep copy — never mutates the original.
 */
export function sanitizeForLogging(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object'
          ? sanitizeForLogging(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Higher-order wrapper: returns a PII-scrubbed copy for logging.
 * Use as: console.log(withPrivacyFilter(sensitiveData))
 */
export function withPrivacyFilter<T extends Record<string, unknown>>(data: T): T {
  return sanitizeForLogging(data) as T;
}
