/**
 * Vercel serverless handler.
 * /health is answered without loading SQLite/Express so the deploy stays diagnosable.
 */

const fs = require('fs');
const path = require('path');

process.env.VERCEL = process.env.VERCEL || '1';
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

let readyApp = null;
let bootPromise = null;

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
        err && err.stack ? String(err.stack).split('\n').slice(0, 16) : []
    })
  );
}

async function boot() {
  if (readyApp) {
    return readyApp;
  }

  let initSqlJs;
  try {
    initSqlJs = require('sql.js');
  } catch (err) {
    err.message = `require(sql.js) failed: ${err.message}`;
    throw err;
  }

  let wasmBinary;
  try {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    wasmBinary = fs.readFileSync(wasmPath);
  } catch (err) {
    err.message = `reading sql-wasm.wasm failed: ${err.message}`;
    throw err;
  }

  try {
    global.__SQLJS = await initSqlJs({ wasmBinary });
  } catch (err) {
    err.message = `initSqlJs failed: ${err.message}`;
    throw err;
  }

  try {
    const { ensureDatabase } = require('../service/db/ensure');
    ensureDatabase();
  } catch (err) {
    err.message = `ensureDatabase failed: ${err.message}`;
    throw err;
  }

  try {
    const appPath = require.resolve('../service/src/app');
    Object.keys(require.cache).forEach((key) => {
      if (
        key === appPath ||
        key.includes(`${path.sep}service${path.sep}src${path.sep}`) ||
        key.includes(`${path.sep}service${path.sep}db${path.sep}`)
      ) {
        delete require.cache[key];
      }
    });
    readyApp = require('../service/src/app');
  } catch (err) {
    err.message = `require(app) failed: ${err.message}`;
    throw err;
  }

  return readyApp;
}

function startBoot() {
  if (!bootPromise) {
    bootPromise = boot();
  }
  return bootPromise;
}

function pathName(req) {
  const raw = req.url || '/';
  return raw.split('?')[0];
}

module.exports = async function handler(req, res) {
  const pathname = pathName(req);

  // Always-safe health (assignment A.10) — no DB load
  if (
    pathname === '/health' ||
    pathname === '/v1/health' ||
    pathname === '/api/health' ||
    pathname === '/api/v1/health'
  ) {
    return sendJson(res, 200, {
      status: 'pass',
      description: 'Study Room Reservation API service is healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      runtime: 'vercel-sqljs'
    });
  }

  try {
    const app = await startBoot();
    return app(req, res);
  } catch (err) {
    console.error('[api] boot/handler error:', err);
    return sendProblem(res, err);
  }
};
