/**
 * SQLite driver selector.
 * - Local / CI: better-sqlite3 (native)
 * - Vercel: sql.js WASM singleton (must not reuse a closed handle)
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

    if (
      sqlJsSingleton &&
      sqlJsSingletonPath === filename &&
      !sqlJsSingleton.closed
    ) {
      return sqlJsSingleton;
    }

    const { createSqlJsDatabase } = require('./sqljs-database');
    const DatabaseCtor = createSqlJsDatabase(SQL);
    sqlJsSingleton = new DatabaseCtor(filename);
    sqlJsSingletonPath = filename;
    return sqlJsSingleton;
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const BetterSqlite3 = require(['better-sqlite3'].join(''));
  return new BetterSqlite3(filename);
}

function Database(filename) {
  return createDatabase(filename);
}

function resetSqlJsSingleton() {
  sqlJsSingleton = null;
  sqlJsSingletonPath = null;
}

module.exports = Database;
module.exports.createDatabase = createDatabase;
module.exports.resetSqlJsSingleton = resetSqlJsSingleton;
