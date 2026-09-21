const crypto = require('crypto');

const DEV_AUTH_SECRET =
  process.env.DEV_AUTH_SECRET ||
  'dev-pbse-local-secret-for-jwt-signing-safe-fallback';

const ISSUER =
  process.env.OIDC_ISSUER ||
  'http://localhost:8080/realms/study-reservation';

const AUDIENCE =
  process.env.OIDC_AUDIENCE || 'study-reservation-api';

function base64UrlEncode(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

const PREDEFINED_PERSONAS = {
  'student-a': {
    name: 'Student A (Full Student)',
    subject: 'student-a',
    role: 'Student',
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:checkin',
      'reservations:write'
    ],
    description: 'Owner of reservations rsv_9X8y7Z and rsv_Cc3Dd4.'
  },

  'student-b': {
    name: 'Student B (Alternate Student)',
    subject: 'student-b',
    role: 'Student',
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:write'
    ],
    description:
      'Owner of reservation rsv_Aa1Bb2. Used to demonstrate Layer 3 object denial.'
  },

  'student-limited': {
    name: 'Student Limited (Read Only)',
    subject: 'student-limited',
    role: 'Student',
    scopes: ['rooms:read'],
    description:
      'Has rooms:read scope only. Used to demonstrate Layer 2 scope denial (403).'
  },

  'courier-a': {
    name: 'Courier A',
    subject: 'courier-a',
    role: 'Courier',
    scopes: ['reservations:read'],
    description: 'Test persona for cross-role ownership denial.'
  },

  'courier-b': {
    name: 'Courier B',
    subject: 'courier-b',
    role: 'Courier',
    scopes: ['reservations:read'],
    description: 'Test persona for cross-role ownership denial.'
  },

  'staff-outlet-a': {
    name: 'Staff Outlet A',
    subject: 'staff-outlet-a',
    role: 'Staff',
    scopes: ['reservations:read'],
    description: 'Test persona for cross-outlet ownership denial.'
  },

  'staff-outlet-b': {
    name: 'Staff Outlet B',
    subject: 'staff-outlet-b',
    role: 'Staff',
    scopes: ['reservations:read'],
    description: 'Test persona for cross-outlet ownership denial.'
  },

  'staff-admin': {
    name: 'Library Staff / Admin',
    subject: 'admin-user',
    role: 'Admin',
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:checkin',
      'reservations:cleanup',
      'reservations:write',
      'admin:manage'
    ],
    description:
      'Has admin:manage and all operational scopes across all reservations.'
  }
};

/**
 * Mints a valid JWT using Node crypto for development, tests, and demo UI.
 */
function mintToken({
  subject = 'student-a',
  scopes = [
    'rooms:read',
    'reservations:read',
    'reservations:create',
    'reservations:cancel'
  ],
  kind = 'user',
  clientId = 'web-client',
  expiresInSeconds = 86400
} = {}) {
  const scopeString = Array.isArray(scopes)
    ? scopes.join(' ')
    : String(scopes || '');

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: subject,
    scope: scopeString,
    client_id: clientId,
    kind,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  const signature = crypto
    .createHmac('sha256', DEV_AUTH_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Returns pre-minted tokens for all predefined demo personas.
 */
function getDemoPersonas() {
  const personas = {};

  for (const [key, p] of Object.entries(PREDEFINED_PERSONAS)) {
    const token = mintToken({
      subject: p.subject,
      scopes: p.scopes,
      kind: 'user',
      clientId: 'web-client'
    });

    personas[key] = {
      ...p,
      token,
      tokenFingerprint: `${token.slice(0, 8)}...${token.slice(-6)}`
    };
  }

  return personas;
}

module.exports = {
  mintToken,
  getDemoPersonas,
  base64UrlEncode,
  base64UrlDecode,
  PREDEFINED_PERSONAS,
  DEV_AUTH_SECRET,
  ISSUER,
  AUDIENCE
};