function toReservationRepresentation(dbRow) {
  if (!dbRow) return null;

  return {
    id: dbRow.id,
    roomId: dbRow.room_id,
    status: dbRow.status,
    createdAt: dbRow.created_at,
    ...(dbRow.ownerSubject ? { userId: dbRow.ownerSubject } : {})
  };
}

function toCancellationRepresentation(dbRow) {
  if (!dbRow) return null;

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
