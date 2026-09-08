/**
 * ============================================================================
 * STUDY ROOM STORE (DATABASE ACCESS LAYER)
 * Owned by: PERSON 2 (Study Room Resource)
 * ============================================================================
 * Responsibilities (Page 3):
 * - All SQL queries for rooms must live inside this file.
 * - Find all rooms with query filtering.
 * - Find room by ID.
 * - Never let queries leak outside the store/ layer.
 * ============================================================================
 */

// TODO (Person 2): Implement database operations for rooms
// e.g., findAllRooms(filters), findRoomById(id)

const path = require('path');
const Database = require('better-sqlite3');

const configuredPath = process.env.DATABASE_PATH;

const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(__dirname, '..', '..', configuredPath);

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

function findAllRooms() {
  return db
    .prepare(`
      SELECT id, name, capacity, location, created_at
      FROM rooms
      ORDER BY created_at ASC
    `)
    .all();
}

function findRoomById(id) {
  return db
    .prepare(`
      SELECT id, name, capacity, location, created_at
      FROM rooms
      WHERE id = ?
    `)
    .get(id);
}

module.exports = {
  findAllRooms,
  findRoomById
};