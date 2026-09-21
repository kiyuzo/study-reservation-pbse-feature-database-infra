const requiredEnv = [
  'DATABASE_PATH',
  'OIDC_ISSUER',
  'OIDC_JWKS_URI',
  'OIDC_AUDIENCE'
];

for (const name of requiredEnv) {
  if (!process.env[name] || process.env[name].trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

module.exports = {
  databasePath: process.env.DATABASE_PATH,
  oidc: {
    issuer: process.env.OIDC_ISSUER,
    jwksUri: process.env.OIDC_JWKS_URI,
    audience: process.env.OIDC_AUDIENCE
  }
};