/**
 * Vercel serverless handler (req, res) — boots sql.js then delegates to Express.
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

const serviceModules = path.join(__dirname, '..', 'service', 'node_modules');
if (!module.paths.includes(serviceModules)) {
  module.paths.unshift(serviceModules);
}

let readyApp = null;
let bootPromise = null;

async function boot() {
  if (readyApp) {
    return readyApp;
  }

  const initSqlJs = require('sql.js');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  global.__SQLJS = await initSqlJs({ wasmBinary });

  const { ensureDatabase } = require('../service/db/ensure');
  ensureDatabase();

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
  return readyApp;
}

function startBoot() {
  if (!bootPromise) {
    bootPromise = boot();
  }
  return bootPromise;
}

module.exports = async function handler(req, res) {
  try {
    const app = await startBoot();
    return app(req, res);
  } catch (err) {
    console.error('[api] boot/handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    res.end(
      JSON.stringify({
        type: 'https://api.library.example/problems/internal-server-error',
        title: 'Internal Server Error',
        status: 500,
        detail: err && err.message ? err.message : String(err),
        bootStack:
          err && err.stack ? String(err.stack).split('\n').slice(0, 12) : []
      })
    );
  }
};
