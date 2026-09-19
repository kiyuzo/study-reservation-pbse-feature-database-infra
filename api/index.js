/**
 * Vercel serverless entry — boots sql.js (WASM), ensures /tmp DB, exports Express.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

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
let bootError = null;

async function boot() {
  if (readyApp) {
    return readyApp;
  }
  if (bootError) {
    throw bootError;
  }

  const initSqlJs = require('sql.js');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });
  global.__SQLJS = SQL;

  const { ensureDatabase } = require('../service/db/ensure');
  ensureDatabase();

  // Clear require cache so stores pick up sql.js driver after __SQLJS is set
  const appPath = require.resolve('../service/src/app');
  delete require.cache[appPath];
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(`${path.sep}service${path.sep}src${path.sep}`)) {
      delete require.cache[key];
    }
  });

  readyApp = require('../service/src/app');
  return readyApp;
}

function startBoot() {
  if (!bootPromise) {
    bootPromise = boot().catch((err) => {
      bootError = err;
      console.error('[api] boot failed:', err);
      throw err;
    });
  }
  return bootPromise;
}

const gateway = express();
gateway.use(async (req, res) => {
  try {
    const app = await startBoot();
    return app(req, res);
  } catch (err) {
    console.error('[api] request boot error:', err);
    res.status(500).type('application/problem+json').json({
      type: 'https://api.library.example/problems/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: err && err.message ? err.message : String(err),
      bootStack: err && err.stack ? String(err.stack).split('\n').slice(0, 12) : []
    });
  }
});

module.exports = gateway;
