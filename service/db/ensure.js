/**
 * Ensure SQLite exists. On Vercel, prefer schema/seed copied under api/.
 */

const fs = require('fs');
const path = require('path');
const Database = require('../src/db/driver');

function resolveDbPath(configuredPath) {
  const serviceRoot = path.join(__dirname, '..');
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(serviceRoot, configuredPath);
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

  if (fs.existsSync(dbPath)) {
    return dbPath;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { schemaSql, seedSql } = readSqlFiles();

  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    db.exec(seedSql);
  } finally {
    // Persist + close, then drop singleton so stores open a fresh handle
    db.close();
    if (typeof Database.resetSqlJsSingleton === 'function') {
      Database.resetSqlJsSingleton();
    }
  }

  console.log(`[db:ensure] Created and seeded database at ${dbPath}`);
  return dbPath;
}

module.exports = { ensureDatabase, resolveDbPath };
