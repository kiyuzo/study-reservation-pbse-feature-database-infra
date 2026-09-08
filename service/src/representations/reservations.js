/**
 * ============================================================================
 * RESERVATION REPRESENTATION
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 * Responsibilities (Pages 4-5):
 * - Never return raw DB rows.
 * - Map database row -> API representation matching openapi.yaml:
 *   - id, roomId, status, createdAt
 *   - convenience flags if needed: cancellable, canCheckIn
 * - Cancellation representation for POST .../cancellation
 * ============================================================================
 */

// TODO (Person 3): Implement reservation representation mapping
// function toReservationRepresentation(dbRow) { ... }

function toReservationRepresentation(dbRow) {
  if (!dbRow) {
    return null;
  }

  return {
    id: dbRow.id,
    roomId: dbRow.room_id,
    status: dbRow.status,
    createdAt: dbRow.created_at
  };
}

function toCancellationRepresentation(dbRow) {
  if (!dbRow) {
    return null;
  }

  return {
    reservationId: dbRow.id,
    reason: dbRow.cancel_reason,
    cancelledAt: dbRow.cancelled_at
  };
}

module.exports = {
  toReservationRepresentation,
  toCancellationRepresentation
};
