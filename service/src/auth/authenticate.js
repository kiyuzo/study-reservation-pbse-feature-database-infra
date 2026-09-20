const { verifyAccessToken } = require('./verify');
const { buildPrincipal } = require('./principal');
const { unauthorized } = require('../problem');

async function authenticate(req, res, next) {
  const authorization = req.get('Authorization');

  // No token → public request
  if (!authorization) {
    req.principal = null;
    return next();
  }

  const [scheme, token] = authorization.split(' ');

  // Malformed Authorization header
  if (scheme !== 'Bearer' || !token) {
    return unauthorized(res);
  }

  try {
    const payload = await verifyAccessToken(token);
    req.principal = buildPrincipal(payload);
    return next();
  } catch (error) {
    console.warn('Authentication failed:', error.message);
    return unauthorized(res);
  }
}

module.exports = {
  authenticate
};