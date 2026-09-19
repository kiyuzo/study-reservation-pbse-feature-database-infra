/**
 * SQLite driver selector.
 * - Local / CI: better-sqlite3 (native) via separate file so Vercel NFT won't load it
 * - Vercel: sql.js WASM singleton
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

  // Keep native require out of the Vercel traced graph when USE_SQLJS/VERCEL is set at build...
  // NFT still may see this file; use a non-literal require for native only.
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const BetterSqlite3 = require(['better-sqlite3'].join(''));
  return new BetterSqlite3(filename);
}

function Database(filename) {
  return createDatabase(filename);
}

module.exports = Database;
module.exports.createDatabase = createDatabase;
