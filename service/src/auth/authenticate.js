const { verifyAccessToken } = require('./verify');
const { buildPrincipal } = require('./principal');
const { unauthorized } = require('../problem');
const { logSecurityEvent } = require('../security/audit-logger');

async function authenticate(req, res, next) {
  const authorization = req.get('Authorization');

  // No token present -> set principal to null (public route or will trigger 401 in requireScope)
  if (!authorization) {
    req.principal = null;
    return next();
  }

  const parts = authorization.trim().split(/\s+/);
  const scheme = parts[0];
  const token = parts[1];

  // Malformed Authorization header
  if (scheme !== 'Bearer' || !token || parts.length !== 2) {
    logSecurityEvent({
      event: 'authentication.failure',
      actorId: 'anonymous',
      method: req.method,
      path: req.originalUrl || req.path,
      result: 'denied',
      reason: 'malformed_authorization_header',
      requestId: req.id
    });
    return unauthorized(res);
  }

  try {
    const payload = await verifyAccessToken(token);
    req.principal = buildPrincipal(payload);
    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'authentication.failure',
      actorId: 'anonymous',
      method: req.method,
      path: req.originalUrl || req.path,
      result: 'denied',
      reason: 'invalid_or_expired_token',
      requestId: req.id
    });
    return unauthorized(res);
  }
}

module.exports = {
  authenticate
};