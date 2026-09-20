const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');

const jwks = createRemoteJWKSet(new URL(config.oidc.jwksUri));

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.oidc.issuer,
    audience: config.oidc.audience,
    algorithms: ['RS256'],
    clockTolerance: 5
  });

  return payload;
}

module.exports = {
  verifyAccessToken
};