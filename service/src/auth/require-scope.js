const { forbidden, unauthorized } = require('../problem');
const { logSecurityEvent } = require('../security/audit-logger');

/**
 * Middleware factory requiring that the authenticated principal possesses at least one
 * of the specified scope strings (Layer 2 Authorization).
 *
 * @param {...(string|string[])} requiredScopes - Required scope(s)
 */
function requireScope(...requiredScopes) {
  const flattened = requiredScopes.flat().filter(Boolean);

  return (req, res, next) => {
    // 1. Unauthenticated -> 401 Unauthorized
    if (!req.principal) {
      logSecurityEvent({
        event: 'authentication.required',
        actorId: 'anonymous',
        method: req.method,
        path: req.originalUrl || req.path,
        result: 'denied',
        reason: 'missing_bearer_token',
        requestId: req.id
      });
      return unauthorized(res);
    }

    const principalScopes = Array.isArray(req.principal.scopes)
      ? req.principal.scopes
      : [];

    // Admin scope bypasses granular scope requirements
    if (principalScopes.includes('admin:manage')) {
      return next();
    }

    // Check if principal has at least one of the required scopes
    const hasScope = flattened.some((s) => principalScopes.includes(s));

    if (!hasScope) {
      const primaryScope = flattened[0] || 'required_scope';

      logSecurityEvent({
        event: 'authorization.scope_denied',
        actorId: req.principal.subject,
        method: req.method,
        path: req.originalUrl || req.path,
        result: 'denied',
        reason: `missing_scope_${primaryScope}`,
        requestId: req.id,
        metadata: {
          required: flattened,
          granted: principalScopes
        }
      });

      return forbidden(res, primaryScope);
    }

    return next();
  };
}

module.exports = {
  requireScope
};