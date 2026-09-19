/**
 * SQLite driver selector.
 * - Local / CI: better-sqlite3 (native)
 * - Vercel: sql.js WASM singleton (set global.__SQLJS after async boot)
 */

let sqlJsSingleton = null;
let sqlJsSingletonPath = null;

function createDatabase(filename) {
  if (process.env.VERCEL || process.env.USE_SQLJS === '1') {
    const SQL = global.__SQLJS;
    if (!SQL) {
      throw new Error(
        'sql.js is not initialized. Boot api/index.js must call initSqlJs before loading stores.'
      );
    }

    if (sqlJsSingleton && sqlJsSingletonPath === filename) {
      return sqlJsSingleton;
    }

    const { createSqlJsDatabase } = require('./sqljs-database');
    const DatabaseCtor = createSqlJsDatabase(SQL);
    sqlJsSingleton = new DatabaseCtor(filename);
    sqlJsSingletonPath = filename;
    return sqlJsSingleton;
  }

  const BetterSqlite3 = require('better-sqlite3');
  return new BetterSqlite3(filename);
}

// Mimic better-sqlite3: module.exports = function Database(path) {}
function Database(filename) {
  return createDatabase(filename);
}

module.exports = Database;
module.exports.createDatabase = createDatabase;
