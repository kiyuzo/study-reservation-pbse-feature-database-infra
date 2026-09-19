/**
 * Ensure SQLite exists. On Vercel, prefer schema/seed under api/.
 * For :memory:, always seed into the live sql.js singleton (do not close it).
 */

const fs = require('fs');
const path = require('path');
const Database = require('../src/db/driver');

function resolveDbPath(configuredPath) {
  return Database.resolveDbPath(
    configuredPath,
    path.join(__dirname, '..')
  );
}

function readSqlFiles() {
  const candidates = [
    {
      schema: path.join(__dirname, '../../api/schema.sql'),
      seed: path.join(__dirname, '../../api/seed.sql')
    },
    {
      schema: path.join(__dirname, 'schema.sql'),
      seed: path.join(__dirname, 'seed.sql')
    }
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.schema) && fs.existsSync(c.seed)) {
      return {
        schemaSql: fs.readFileSync(c.schema, 'utf8'),
        seedSql: fs.readFileSync(c.seed, 'utf8')
      };
    }
  }

  throw new Error('schema.sql / seed.sql not found next to function or in service/db');
}

function ensureDatabase() {
  const configuredPath = process.env.DATABASE_PATH || './db/reservation.sqlite';
  const dbPath = resolveDbPath(configuredPath);
  const { schemaSql, seedSql } = readSqlFiles();

  // :memory: — always (re)apply into the shared singleton; never close it
  if (dbPath === ':memory:') {
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    db.exec(seedSql);
    console.log('[db:ensure] Seeded in-memory database for Vercel');
    return dbPath;
  }

  if (fs.existsSync(dbPath)) {
    return dbPath;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    db.exec(seedSql);
  } finally {
    db.close();
    if (typeof Database.resetSqlJsSingleton === 'function') {
      Database.resetSqlJsSingleton();
    }
  }

  console.log(`[db:ensure] Created and seeded database at ${dbPath}`);
  return dbPath;
}

module.exports = { ensureDatabase, resolveDbPath };
