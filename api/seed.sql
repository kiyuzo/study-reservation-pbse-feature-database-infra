-- ============================================================================
-- DATABASE SEED DATA — Study Room Reservation System
-- Owned by: PERSON 1 (Database + App Infrastructure)
-- ============================================================================
-- Apply AFTER schema.sql on an empty (or freshly created) database:
--   sqlite3 ./db/reservation.sqlite < db/schema.sql
--   sqlite3 ./db/reservation.sqlite < db/seed.sql
--
-- Uses openapi.yaml example ids (rm_1a2B3cD, rsv_9X8y7Z).
-- No personal / student PII (Session 3 rule).
-- Idempotency keys are NOT seeded — they are written at runtime by P4.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, name, capacity, location, created_at) VALUES
    ('rm_1a2B3cD', 'Study Room A', 4,  'Library Floor 1 - Wing A', '2026-08-01T09:00:00+07:00'),
    ('rm_2b3C4dE', 'Study Room B', 6,  'Library Floor 1 - Wing B', '2026-08-01T09:00:00+07:00'),
    ('rm_3c4D5eF', 'Quiet Pod C',  2,  'Library Floor 2 - Quiet Zone', '2026-08-01T09:00:00+07:00');

-- ---------------------------------------------------------------------------
-- Reservations (several statuses for list/filter demos)
-- ---------------------------------------------------------------------------
INSERT INTO reservations (
    id, room_id, date, start_time, end_time, status,
    created_at, cancel_reason, cancelled_at, checked_in_at
) VALUES
    (
        'rsv_9X8y7Z',
        'rm_1a2B3cD',
        '2026-08-31',
        '14:00',
        '16:00',
        'pending_checkin',
        '2026-08-30T12:10:04+07:00',
        NULL,
        NULL,
        NULL
    ),
    (
        'rsv_Aa1Bb2',
        'rm_2b3C4dE',
        '2026-08-31',
        '10:00',
        '12:00',
        'checked_in',
        '2026-08-30T08:00:00+07:00',
        NULL,
        NULL,
        '2026-08-31T10:05:00+07:00'
    ),
    (
        'rsv_Cc3Dd4',
        'rm_3c4D5eF',
        '2026-08-30',
        '09:00',
        '11:00',
        'cancelled',
        '2026-08-29T18:00:00+07:00',
        'Changed my mind',
        '2026-08-30T08:00:00+07:00',
        NULL
    ),
    (
        'rsv_Ee5Ff6',
        'rm_1a2B3cD',
        '2026-08-29',
        '13:00',
        '15:00',
        'completed',
        '2026-08-28T11:00:00+07:00',
        NULL,
        NULL,
        '2026-08-29T13:02:00+07:00'
    );

-- ---------------------------------------------------------------------------
-- Reservation Owners (Security Layer 3 ownership mapping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_owners (
    reservation_id TEXT PRIMARY KEY,
    owner_subject TEXT NOT NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO reservation_owners (reservation_id, owner_subject) VALUES
    ('rsv_9X8y7Z', 'student-a'),
    ('rsv_Aa1Bb2', 'student-b'),
    ('rsv_Cc3Dd4', 'student-a'),
    ('rsv_Ee5Ff6', 'admin-user');
