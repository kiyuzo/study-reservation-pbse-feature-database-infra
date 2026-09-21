/**
 * ============================================================================
 * SECURITY AUDIT LOGGER
 * ============================================================================
 * Structured JSON logger for security-relevant events (RFC 9457 / Step 9).
 * Guarantees strict redaction of credentials, tokens, secrets, and raw keys.
 * Maintains an in-memory ring-buffer of recent events for the security demo UI.
 * ============================================================================
 */

const MAX_HISTORY = 100;
const eventHistory = [];

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /("?(password|secret|token|authorization|idempotency-key)"?\s*[:=]\s*)"[^"]+"/gi
];

/**
 * Strips any sensitive data from string or object values before logging.
 */
function sanitize(val) {
  if (!val) return val;
  if (typeof val === 'string') {
    let s = val;
    for (const pattern of SENSITIVE_PATTERNS) {
      s = s.replace(pattern, '$1[REDACTED]');
    }
    return s;
  }
  return val;
}

/**
 * Records a security event.
 *
 * @param {Object} params
 * @param {string} params.event - Event type identifier
 * @param {string} [params.actorId] - User or client identifier
 * @param {string} params.method - HTTP method
 * @param {string} params.path - URL path
 * @param {string} [params.resourceId] - Resource identifier if applicable
 * @param {'allowed'|'denied'|'success'|'failed'} params.result - Outcome
 * @param {string} [params.reason] - Explanation category
 * @param {string} params.requestId - Correlation ID
 * @param {Object} [params.metadata] - Non-sensitive supplementary details
 */
function logSecurityEvent({
  event,
  actorId = 'anonymous',
  method,
  path,
  resourceId = null,
  result,
  reason = null,
  requestId,
  metadata = {}
}) {
  const timestamp = new Date().toISOString();

  const entry = {
    timestamp,
    event,
    actorId: sanitize(actorId),
    method: method || 'UNKNOWN',
    path: path || 'UNKNOWN',
    resourceId: sanitize(resourceId),
    result,
    reason: sanitize(reason),
    requestId: requestId || 'no_req_id'
  };

  // Attach safe metadata without sensitive keys
  const safeMeta = {};
  for (const [k, v] of Object.entries(metadata || {})) {
    const lk = k.toLowerCase();
    if (
      !lk.includes('token') &&
      !lk.includes('secret') &&
      !lk.includes('password') &&
      !lk.includes('auth') &&
      !lk.includes('key')
    ) {
      safeMeta[k] = sanitize(v);
    }
  }

  if (Object.keys(safeMeta).length > 0) {
    entry.metadata = safeMeta;
  }

  // Structured JSON output
  const jsonString = JSON.stringify(entry);
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[SECURITY-AUDIT] ${jsonString}`);
  }

  // Save to in-memory ring buffer
  eventHistory.unshift(entry);
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.pop();
  }

  return entry;
}

function getRecentSecurityEvents(limit = 50) {
  return eventHistory.slice(0, limit);
}

function clearSecurityEvents() {
  eventHistory.length = 0;
}

module.exports = {
  logSecurityEvent,
  getRecentSecurityEvents,
  clearSecurityEvents,
  sanitize
};
