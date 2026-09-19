/**
 * Vercel serverless entry — exports the Express app.
 * Must set env + ensure /tmp SQLite before requiring stores via app.js.
 */

const path = require('path');
const express = require('express');

process.env.VERCEL = process.env.VERCEL || '1';
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

let app;
try {
  const { ensureDatabase } = require('../service/db/ensure');
  ensureDatabase();
  app = require('../service/src/app');
} catch (err) {
  console.error('[api] Failed to boot Express app:', err);
  app = express();
  app.use((req, res) => {
    res.status(500).json({
      type: 'https://api.library.example/problems/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: err && err.message ? err.message : String(err),
      bootStack: err && err.stack ? String(err.stack).split('\n').slice(0, 8) : []
    });
  });
}

module.exports = app;
