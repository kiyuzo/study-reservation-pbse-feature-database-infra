/**
 * Apply schema.sql + seed.sql to a fresh SQLite database.
 * Owned by: PERSON 1 (Database + App Infrastructure)
 *
 * Usage (from service/):
 *   npm run db:init
 *
 * Resets the database file so demos are reproducible from a clean checkout.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');

const REQUIRED = ['DATABASE_PATH'];
const missing = REQUIRED.filter((key) => {
  const value = process.env[key];
  return value === undefined || String(value).trim() === '';
});

if (missing.length > 0) {
  console.error(
    `[db:init] Missing required environment variable(s): ${missing.join(', ')}`
  );
  console.error('[db:init] Copy service/.env.example to service/.env first.');
  process.exit(1);
}

const serviceRoot = path.join(__dirname, '..');
const configuredPath = process.env.DATABASE_PATH;
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(serviceRoot, configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`[db:init] Removed existing database at ${dbPath}`);
}

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

const db = new Database(dbPath);
try {
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  db.exec(seedSql);

  const rooms = db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n;
  const reservations = db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n;

  console.log(`[db:init] Created ${dbPath}`);
  console.log(`[db:init] Seeded ${rooms} room(s), ${reservations} reservation(s)`);
} finally {
  db.close();
}
