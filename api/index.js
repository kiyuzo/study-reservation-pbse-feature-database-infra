/**
 * Vercel Node serverless entry.
 * No top-level requires — module load must never throw.
 */

process.env.VERCEL = '1';
process.env.USE_SQLJS = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
// In-memory DB avoids /tmp I/O hangs on some Vercel runtimes
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
process.env.BASE_URL =
  process.env.BASE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

let bootPromise = null;
let expressApp = null;

function getPathname(req) {
  const raw = (req && req.url) || '/';
  try {
    if (String(raw).startsWith('http')) {
      return new URL(String(raw)).pathname;
    }
  } catch {
    // ignore
  }
  return String(raw).split('?')[0];
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

async function boot() {
  if (expressApp) {
    return expressApp;
  }

  const fs = require('fs');
  const path = require('path');
  const initSqlJs = require('sql.js');

  const wasmFile = path.join(__dirname, '_vendor', 'sql-wasm.wasm');
  if (!fs.existsSync(wasmFile)) {
    throw new Error(`Missing wasm at ${wasmFile}`);
  }

  global.__SQLJS = await initSqlJs({
    wasmBinary: fs.readFileSync(wasmFile)
  });

  // Force memory DB for this isolate
  process.env.DATABASE_PATH = ':memory:';

  const { ensureDatabase } = require('../service/db/ensure');
  ensureDatabase();

  // Load app once; do not wipe the whole require cache (can deadlock)
  expressApp = require('../service/src/app');
  return expressApp;
}

function startBoot() {
  if (!bootPromise) {
    bootPromise = boot().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

module.exports = async function handler(req, res) {
  try {
    const pathname = getPathname(req);

    if (
      pathname === '/health' ||
      pathname === '/v1/health' ||
      pathname.endsWith('/health')
    ) {
      return sendJson(res, 200, {
        status: 'pass',
        description: 'Study Room Reservation API service is healthy',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        runtime: 'vercel',
        path: pathname
      });
    }

    const app = await startBoot();
    return app(req, res);
  } catch (err) {
    console.error('[api]', err);
    return sendProblem(res, err);
  }
};
