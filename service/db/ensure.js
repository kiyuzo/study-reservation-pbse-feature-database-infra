/**
 * Ensure SQLite exists. On Vercel, prefer schema/seed under api/.
 * For :memory:, apply schema into the live sql.js singleton (do not close it)
 * and seed only when the database is empty (idempotent across boot retries).
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

function countRooms(db) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM rooms').get();
  return row && typeof row.n === 'number' ? row.n : Number(row && row.n) || 0;
}

function ensureDatabase() {
  const configuredPath = process.env.DATABASE_PATH || './db/reservation.sqlite';
  const dbPath = resolveDbPath(configuredPath);
  const { schemaSql, seedSql } = readSqlFiles();

  // :memory: — shared sql.js singleton; schema is IF NOT EXISTS; seed only if empty
  if (dbPath === ':memory:') {
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    if (countRooms(db) === 0) {
      db.exec(seedSql);
      console.log('[db:ensure] Seeded in-memory database for Vercel');
    } else {
      console.log('[db:ensure] In-memory database already seeded; skipping seed');
    }
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
