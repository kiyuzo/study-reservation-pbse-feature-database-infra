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
const Database = require('../db/driver');

const dbPath = Database.resolveDbPath(
  process.env.DATABASE_PATH,
  path.join(__dirname, '..', '..')
);

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

// Ensure ownership table exists without changing the frozen base schema.
db.exec(`
  CREATE TABLE IF NOT EXISTS reservation_owners (
    reservation_id TEXT PRIMARY KEY,
    owner_subject TEXT NOT NULL,
    FOREIGN KEY (reservation_id)
      REFERENCES reservations(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reservation_owners_subject
    ON reservation_owners (owner_subject);
`);

// -----------------------------------------------------------------------------
// Find reservation by ID
// -----------------------------------------------------------------------------

function findReservationById(id) {
  return db
    .prepare(`
      SELECT
        r.id,
        r.room_id,
        r.date,
        r.start_time,
        r.end_time,
        r.status,
        r.created_at,
        r.cancel_reason,
        r.cancelled_at,
        r.checked_in_at,
        o.owner_subject AS ownerSubject
      FROM reservations r
      LEFT JOIN reservation_owners o
        ON r.id = o.reservation_id
      WHERE r.id = ?
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
  createdAt,
  ownerSubject
}) {
  // 1. Insert the reservation.
  db.prepare(`
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
  `).run(
    id,
    roomId,
    date,
    startTime,
    endTime,
    status,
    createdAt
  );

  // 2. Store the reservation owner separately.
  if (ownerSubject) {
    db.prepare(`
      INSERT INTO reservation_owners (
        reservation_id,
        owner_subject
      )
      VALUES (?, ?)
    `).run(id, ownerSubject);
  }

  // 3. Return the created reservation.
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


function checkInReservation(id) {
  const checkedInAt = new Date().toISOString();

  db.prepare(`
    UPDATE reservations
    SET status = 'checked_in',
        checked_in_at = ?
    WHERE id = ?
  `).run(checkedInAt, id);

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
  cancelReservation,
  checkInReservation
};
