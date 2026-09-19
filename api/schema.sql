-- ============================================================================
-- DATABASE SCHEMA — Study Room Reservation System
-- Owned by: PERSON 1 (Database + App Infrastructure)
-- Status: FROZEN (2026-09-03) — do not change columns without team agreement.
-- ============================================================================
-- Runnable from an empty database. Apply with:
--   sqlite3 ./db/reservation.sqlite < db/schema.sql
-- Or via the service db:init script once added.
--
-- Column names are internal. API field names (camelCase) are mapped in
-- representations/. Enable FK enforcement at connection time:
--   PRAGMA foreign_keys = ON;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rooms
-- Opaque ids follow openapi examples: rm_<alphanumeric>
-- Extra columns (name, capacity, location) support P2 room reads/lists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    capacity   INTEGER NOT NULL CHECK (capacity > 0),
    location   TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 2. Reservations
-- API representation: id, roomId, status, createdAt
-- Write body (NewReservation): roomId, date, startTime, endTime
-- Ops columns for cancellation / future check-in (not always in API body)
-- Status machine: pending_checkin | checked_in | cancelled | no_show | completed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id              TEXT PRIMARY KEY,
    room_id         TEXT NOT NULL,
    date            TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    end_time        TEXT NOT NULL,
    status          TEXT NOT NULL
                    CHECK (status IN (
                        'pending_checkin',
                        'checked_in',
                        'cancelled',
                        'no_show',
                        'completed'
                    )),
    created_at      TEXT NOT NULL,
    cancel_reason   TEXT,
    cancelled_at    TEXT,
    checked_in_at   TEXT,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_room_date
    ON reservations (room_id, date);

CREATE INDEX IF NOT EXISTS idx_reservations_status
    ON reservations (status);

-- ---------------------------------------------------------------------------
-- 3. Idempotency keys (Person 4 / grader requirement)
-- Keys retained 24h per openapi.yaml. Must survive process restart.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key              TEXT PRIMARY KEY,
    request_hash     TEXT NOT NULL,
    response_status  INTEGER NOT NULL,
    response_body    TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
    ON idempotency_keys (expires_at);
