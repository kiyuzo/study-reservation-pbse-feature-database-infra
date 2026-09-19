/**
 * Ensure a SQLite file exists (schema + seed) without wiping an existing DB.
 * Used on Vercel cold starts where DATABASE_PATH points at /tmp.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function resolveDbPath(configuredPath) {
  const serviceRoot = path.join(__dirname, '..');
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(serviceRoot, configuredPath);
}

function ensureDatabase() {
  const configuredPath = process.env.DATABASE_PATH || './db/reservation.sqlite';
  const dbPath = resolveDbPath(configuredPath);

  if (fs.existsSync(dbPath)) {
    return dbPath;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    db.exec(seedSql);
  } finally {
    db.close();
  }

  console.log(`[db:ensure] Created and seeded database at ${dbPath}`);
  return dbPath;
}

module.exports = { ensureDatabase, resolveDbPath };
