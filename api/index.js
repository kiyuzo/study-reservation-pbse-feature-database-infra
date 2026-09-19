/**
 * Vercel Node serverless entry.
 * No top-level requires — module load must never throw.
 */

process.env.VERCEL = '1';
process.env.USE_SQLJS = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.DATABASE_PATH =
  process.env.DATABASE_PATH || '/tmp/reservation.sqlite';
process.env.BASE_URL =
  process.env.BASE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

let cached = null;

function getPathname(req) {
  const candidates = [
    req.url,
    req.headers && req.headers['x-forwarded-uri'],
    req.headers && req.headers['x-invoke-path']
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const value = String(raw);
      if (value.startsWith('http')) {
        return new URL(value).pathname;
      }
      return value.split('?')[0];
    } catch {
      // try next
    }
  }
  return '/';
}

function isHealthPath(pathname) {
  return (
    pathname === '/health' ||
    pathname === '/v1/health' ||
    pathname === '/api/health' ||
    pathname === '/api/v1/health' ||
    pathname.endsWith('/health')
  );
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendProblem(res, err) {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  res.end(
    JSON.stringify({
      type: 'https://api.library.example/problems/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: err && err.message ? err.message : String(err),
      bootStack:
        err && err.stack ? String(err.stack).split('\n').slice(0, 20) : []
    })
  );
}

async function getHandler() {
  if (cached) return cached;

  const fs = require('fs');
  const path = require('path');
  const serverless = require('serverless-http');
  const initSqlJs = require('sql.js');

  const wasmFile = path.join(__dirname, 'vendor', 'sql-wasm.wasm');
  if (!fs.existsSync(wasmFile)) {
    throw new Error(`Missing wasm at ${wasmFile}`);
  }

  global.__SQLJS = await initSqlJs({
    wasmBinary: fs.readFileSync(wasmFile)
  });

  const { ensureDatabase } = require('../service/db/ensure');
  ensureDatabase();

  Object.keys(require.cache).forEach((key) => {
    if (key.includes(`${path.sep}service${path.sep}`)) {
      delete require.cache[key];
    }
  });

  const app = require('../service/src/app');
  cached = serverless(app);
  return cached;
}

module.exports = async function handler(req, res) {
  try {
    const pathname = getPathname(req);

    if (isHealthPath(pathname)) {
      return sendJson(res, 200, {
        status: 'pass',
        description: 'Study Room Reservation API service is healthy',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        runtime: 'vercel',
        path: pathname
      });
    }

    // When /health is rewritten to /api, pathname may become "/api"
    if (
      (pathname === '/api' || pathname === '/api/') &&
      String(req.method || 'GET').toUpperCase() === 'GET'
    ) {
      return sendJson(res, 200, {
        status: 'pass',
        description: 'Study Room Reservation API service is healthy',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        runtime: 'vercel',
        path: pathname,
        note: 'rewritten-health'
      });
    }

    const run = await getHandler();
    return run(req, res);
  } catch (err) {
    console.error('[api]', err);
    return sendProblem(res, err);
  }
};
