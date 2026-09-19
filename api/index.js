/**
 * Vercel serverless entry — exports the Express app.
 * Must set env + ensure /tmp SQLite before requiring stores via app.js.
 */

const path = require('path');

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

// Prefer service/node_modules when installed under service/ (local parity)
const serviceModules = path.join(__dirname, '..', 'service', 'node_modules');
if (!module.paths.includes(serviceModules)) {
  module.paths.unshift(serviceModules);
}

const { ensureDatabase } = require('../service/db/ensure');
ensureDatabase();

module.exports = require('../service/src/app');
