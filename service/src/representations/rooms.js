/**
 * ============================================================================
 * STUDY ROOM REPRESENTATION
 * Owned by: PERSON 2 (Study Room Resource)
 * ============================================================================
 * Responsibilities (Pages 3-4):
 * - Never return raw DB rows.
 * - Map database row -> API representation format defined in openapi.yaml.
 * - Exactly one representation function per resource.
 * ============================================================================
 */

// TODO (Person 2): Implement representation transformer
// function toRoomRepresentation(dbRow) { ... }

function toRoomRepresentation(dbRow) {
  return {
    id: dbRow.id,
    name: dbRow.name,
    capacity: dbRow.capacity,
    location: dbRow.location,
    createdAt: dbRow.created_at
  };
}

module.exports = {
  toRoomRepresentation
};
