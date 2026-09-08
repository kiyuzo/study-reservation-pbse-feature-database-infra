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

const REQUIRED_ENV = ['PORT', 'NODE_ENV', 'BASE_URL', 'DATABASE_PATH'];

function assertRequiredConfig() {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return value === undefined || String(value).trim() === '';
  });

  if (missing.length > 0) {
    console.error(
      `[service] Refusing to start — missing required environment variable(s): ${missing.join(', ')}`
    );
    console.error(
      '[service] Copy service/.env.example to service/.env and set every listed variable.'
    );
    process.exit(1);
  }

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(
      `[service] Refusing to start — PORT must be an integer 1–65535 (got "${process.env.PORT}")`
    );
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

app.use(cors());
app.use(express.json());

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

if (NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[service] Study Reservation API running on ${BASE_URL}`);
    console.log(`[service] Health endpoint: ${BASE_URL}/health`);
    console.log(`[service] DATABASE_PATH=${DATABASE_PATH}`);
  });
}

module.exports = app;
