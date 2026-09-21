-- Store reservation ownership separately from the frozen reservations table.
CREATE TABLE IF NOT EXISTS reservation_owners (
    reservation_id TEXT PRIMARY KEY,
    owner_subject  TEXT NOT NULL,
    FOREIGN KEY (reservation_id)
        REFERENCES reservations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservation_owners_subject
    ON reservation_owners (owner_subject);
