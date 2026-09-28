/**
 * better-sqlite3-compatible wrapper around sql.js (WASM).
 * Used on Vercel where native addons often fail to load.
 */

const fs = require('fs');
const path = require('path');

function createSqlJsDatabase(SQL) {
  class Statement {
    constructor(dbWrapper, sql) {
      this.dbWrapper = dbWrapper;
      this.sql = sql;
    }

    get(...params) {
      const stmt = this.dbWrapper.db.prepare(this.sql);
      try {
        if (params.length > 0) {
          stmt.bind(params);
        }
        if (stmt.step()) {
          return stmt.getAsObject();
        }
        return undefined;
      } finally {
        stmt.free();
      }
    }

    all(...params) {
      const stmt = this.dbWrapper.db.prepare(this.sql);
      const rows = [];
      try {
        if (params.length > 0) {
          stmt.bind(params);
        }
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        return rows;
      } finally {
        stmt.free();
      }
    }

    run(...params) {
      this.dbWrapper.db.run(this.sql, params.length > 0 ? params : undefined);
      this.dbWrapper.persist();
      return {
        changes: this.dbWrapper.db.getRowsModified(),
        lastInsertRowid: 0
      };
    }
  }

  class Database {
    constructor(filename) {
      this.filename = filename;
      if (filename && filename !== ':memory:' && fs.existsSync(filename)) {
        const fileBuffer = fs.readFileSync(filename);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
        if (filename && filename !== ':memory:') {
          fs.mkdirSync(path.dirname(filename), { recursive: true });
          this.persist();
        }
      }
    }

    pragma() {
      // better-sqlite3 compatibility no-op / foreign_keys
      try {
        this.db.run('PRAGMA foreign_keys = ON');
      } catch {
        // ignore
      }
      return this;
    }

    prepare(sql) {
      return new Statement(this, sql);
    }

    exec(sql) {
      this.db.exec(sql);
      this.persist();
    }

    persist() {
      if (!this.filename || this.filename === ':memory:') {
        return;
      }
      const data = this.db.export();
      fs.writeFileSync(this.filename, Buffer.from(data));
    }

    close() {
      // Keep :memory: singleton alive for the isolate lifetime
      if (this.filename === ':memory:') {
        return;
      }
      this.persist();
      try {
        this.db.close();
      } catch {
        // already closed
      }
      this.closed = true;
    }
  }

  return Database;
}

module.exports = { createSqlJsDatabase };
