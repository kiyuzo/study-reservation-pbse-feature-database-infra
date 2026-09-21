/**
 * ============================================================================
 * APPLICATION ENTRYPOINT — Express App & Infrastructure
 * Owned by: PERSON 1 (Database + App Infrastructure)
 * ============================================================================
 * Responsibilities:
 * - Express/app setup
 * - Load environment variables
 * - Configuration checks (refuse to start if required vars missing)
 * - Register routes (rooms, reservations) — wired in integration step
 * - Global error handler hookup (Person 4's problem.js) — integration step
 * - /health (no dependency checks)
 * - Server startup
 * ============================================================================
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

// Load .env from service/ regardless of process cwd
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// Safe defaults for tests
if (process.env.NODE_ENV === 'test') {
  process.env.PORT = process.env.PORT || '8080';

  process.env.BASE_URL =
    process.env.BASE_URL || 'http://localhost:8080';

  process.env.DATABASE_PATH =
    process.env.DATABASE_PATH ||
    path.resolve(__dirname, '../db/reservation.sqlite');

  process.env.OIDC_ISSUER =
    process.env.OIDC_ISSUER ||
    'http://localhost:8080/realms/study-reservation';

  process.env.OIDC_JWKS_URI =
    process.env.OIDC_JWKS_URI ||
    'http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs';

  process.env.OIDC_AUDIENCE =
    process.env.OIDC_AUDIENCE || 'study-reservation-api';
}

const REQUIRED_ENV = [
  'PORT',
  'NODE_ENV',
  'BASE_URL',
  'DATABASE_PATH',
  'OIDC_ISSUER',
  'OIDC_JWKS_URI',
  'OIDC_AUDIENCE'
];

function assertRequiredConfig() {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return value === undefined || String(value).trim() === '';
  });

  if (missing.length > 0) {
    const message =
      `[service] Refusing to start — missing required environment variable(s): ${missing.join(', ')}`;
    // process.exit kills the whole Vercel isolate → FUNCTION_INVOCATION_FAILED
    if (process.env.VERCEL) {
      throw new Error(message);
    }
    console.error(message);
    console.error(
      '[service] Copy service/.env.example to service/.env and set every listed variable.'
    );
    process.exit(1);
  }

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const message =
      `[service] Refusing to start — PORT must be an integer 1–65535 (got "${process.env.PORT}")`;
    if (process.env.VERCEL) {
      throw new Error(message);
    }
    console.error(message);
    process.exit(1);
  }
}

assertRequiredConfig();

const PORT = Number(process.env.PORT);
const NODE_ENV = process.env.NODE_ENV;
const BASE_URL = process.env.BASE_URL.replace(/\/$/, '');
const DATABASE_PATH = process.env.DATABASE_PATH;

const app = express();

app.locals.config = {
  port: PORT,
  nodeEnv: NODE_ENV,
  baseUrl: BASE_URL,
  databasePath: DATABASE_PATH
};

// Request ID — must run before authentication/logging
const { requestIdMiddleware } = require('./middleware/request-id');
app.use(requestIdMiddleware);

app.use(cors({
  exposedHeaders: ['X-Request-ID', 'Location', 'WWW-Authenticate']
}));

app.use(express.json());

// Authentication middleware
const { authenticate } = require('./auth/authenticate');
app.use(authenticate);

// ----------------------------------------------------------------------------
// Health Check — 200 only; must NOT check the database (assignment A.10)
// ----------------------------------------------------------------------------
const healthPayload = () => ({
  status: 'pass',
  description: 'Study Room Reservation API service is healthy',
  version: '0.1.0',
  timestamp: new Date().toISOString()
});

app.get('/health', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/v1/health', (req, res) => {
  res.status(200).json(healthPayload());
});

// ----------------------------------------------------------------------------
// Documentation & OpenAPI Spec Routes
// ----------------------------------------------------------------------------
const docsRouter = require('./routes/docs');
app.use(docsRouter);

app.get('/', (req, res) => {
  res.redirect('/docs');
});

// ----------------------------------------------------------------------------
// Route Registrations
// ----------------------------------------------------------------------------
const roomsRouter = require('./routes/rooms');
app.use('/v1/rooms', roomsRouter);

const reservationsRouter = require('./routes/reservations');
app.use('/v1/reservations', reservationsRouter);

// ----------------------------------------------------------------------------
// RFC 9457 Problem Details Handlers (Person 4 problem.js)
// ----------------------------------------------------------------------------
const { notFoundHandler, problemHandler } = require('./problem');

app.use(notFoundHandler);
app.use(problemHandler);

// Vercel runs this as a serverless function — do not call listen().
const isVercel = Boolean(process.env.VERCEL);
if (NODE_ENV !== 'test' && !isVercel) {
  app.listen(PORT, () => {
    console.log(`[service] Study Reservation API running on ${BASE_URL}`);
    console.log(`[service] Health endpoint: ${BASE_URL}/health`);
    console.log(`[service] DATABASE_PATH=${DATABASE_PATH}`);
  });
}

module.exports = app;
