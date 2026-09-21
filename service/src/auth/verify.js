const crypto = require('crypto');
const config = require('../config');
const { DEV_AUTH_SECRET, base64UrlDecode } = require('./tokens');

// Optional remote JWKS cache
let jwksCache = null;
let lastJwksFetch = 0;

async function fetchRemoteJwks(jwksUri) {
  const now = Date.now();
  if (jwksCache && now - lastJwksFetch < 300000) {
    return jwksCache;
  }
  const res = await fetch(jwksUri);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status}`);
  }
  const data = await res.json();
  jwksCache = data.keys || [];
  lastJwksFetch = now;
  return jwksCache;
}

async function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or malformed.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT structure.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    throw new Error('Failed to parse JWT header or payload.');
  }

  // 1. Expiration check
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && payload.exp < now - 5) {
    throw new Error('Token has expired.');
  }

  // 2. Issuer check
  const expectedIssuer = config.oidc && config.oidc.issuer;
  if (expectedIssuer && payload.iss && payload.iss !== expectedIssuer) {
    throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`);
  }

  // 3. Audience check
  const expectedAudience = config.oidc && config.oidc.audience;
  if (expectedAudience && payload.aud && payload.aud !== expectedAudience) {
    throw new Error(`Invalid audience: expected ${expectedAudience}, got ${payload.aud}`);
  }

  // 4. Algorithm validation & signature verification
  if (header.alg === 'HS256') {
    const expectedSig = crypto
      .createHmac('sha256', DEV_AUTH_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (
      signature.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return payload;
    }
    throw new Error('Invalid HMAC signature.');
  }

  // Remote RS256 JWKS verification for Keycloak tokens
  if (header.alg === 'RS256' && config.oidc && config.oidc.jwksUri) {
    try {
      const keys = await fetchRemoteJwks(config.oidc.jwksUri);
      const keyObj = keys.find((k) => k.kid === header.kid) || keys[0];
      if (!keyObj) {
        throw new Error('No matching key found in remote JWKS.');
      }
      const pubKey = crypto.createPublicKey({ key: keyObj, format: 'jwk' });
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${encodedHeader}.${encodedPayload}`);
      const valid = verifier.verify(pubKey, Buffer.from(signature, 'base64url'));
      if (valid) {
        return payload;
      }
      throw new Error('Invalid RS256 signature.');
    } catch (err) {
      throw new Error(`RS256 verification failed: ${err.message}`);
    }
  }

  throw new Error(`Unsupported algorithm: ${header.alg}`);
}

module.exports = {
  verifyAccessToken
};