/**
 * ============================================================================
 * RESERVATION STORE (DATABASE ACCESS LAYER)
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 * Responsibilities (Pages 4-5):
 * - All SQL queries for reservations live here.
 * - Find reservations (with filtering by status and pagination).
 * - Find reservation by ID.
 * - Insert new reservation.
 * - Check time-slot availability / conflict checking (prevents double booking).
 * - Update reservation status for cancellation
 * ============================================================================
 */

// TODO (Person 3): Implement reservation database operations
// e.g., createReservation(data), findReservationById(id), checkRoomConflict(roomId, date, startTime, endTime)

const path = require('path');
const Database = require('better-sqlite3');

const configuredPath = process.env.DATABASE_PATH;

const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(__dirname, '..', '..', configuredPath);

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

// -----------------------------------------------------------------------------
// Find reservation by ID
// -----------------------------------------------------------------------------

function findReservationById(id) {
  return db
    .prepare(`
      SELECT
        id,
        room_id,
        date,
        start_time,
        end_time,
        status,
        created_at,
        cancel_reason,
        cancelled_at,
        checked_in_at
      FROM reservations
      WHERE id = ?
    `)
    .get(id);
}

// -----------------------------------------------------------------------------
// Find all reservations
// Supports:
// - status filter
// - limit
// - cursor
// -----------------------------------------------------------------------------

function findAllReservations({ status, limit = 20, cursor } = {}) {
  let query = `
    SELECT
      id,
      room_id,
      date,
      start_time,
      end_time,
      status,
      created_at,
      cancel_reason,
      cancelled_at,
      checked_in_at
    FROM reservations
  `;

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (cursor) {
    conditions.push('id > ?');
    params.push(cursor);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY id ASC LIMIT ?';
  params.push(limit);

  return db
    .prepare(query)
    .all(...params);
}

function findRoomById(roomId) {
  return db
    .prepare(`
      SELECT id
      FROM rooms
      WHERE id = ?
    `)
    .get(roomId);
}

function findConflictingReservation(roomId, date, startTime, endTime) {
  return db
    .prepare(`
      SELECT id
      FROM reservations
      WHERE room_id = ?
        AND date = ?
        AND status != 'cancelled'
        AND start_time < ?
        AND end_time > ?
      LIMIT 1
    `)
    .get(
      roomId,
      date,
      endTime,
      startTime
    );
}

function createReservation({
  id,
  roomId,
  date,
  startTime,
  endTime,
  status,
  createdAt
}) {
  db
    .prepare(`
      INSERT INTO reservations (
        id,
        room_id,
        date,
        start_time,
        end_time,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      roomId,
      date,
      startTime,
      endTime,
      status,
      createdAt
    );

  return findReservationById(id);
}

const {
  findIdempotencyKey,
  saveIdempotencyKey,
  checkIdempotencyKey,
  saveIdempotencyResult
} = require('./idempotency');

function cancelReservation(id, cancelReason = null) {
  const cancelledAt = new Date().toISOString();

  db
    .prepare(`
      UPDATE reservations
      SET
        status = 'cancelled',
        cancel_reason = ?,
        cancelled_at = ?
      WHERE id = ?
    `)
    .run(
      cancelReason,
      cancelledAt,
      id
    );

  return findReservationById(id);
}

module.exports = {
  findReservationById,
  findAllReservations,
  findRoomById,
  findConflictingReservation,
  createReservation,
  findIdempotencyKey,
  saveIdempotencyKey,
  cancelReservation
};