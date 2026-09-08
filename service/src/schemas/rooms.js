/**
 * ============================================================================
 * STUDY ROOM VALIDATION SCHEMAS
 * Owned by: PERSON 2 (Study Room Resource)
 * ============================================================================
 * Responsibilities (Page 3):
 * - Validate room_id (format / prefix: 'rm_...')
 * - Validate query parameters for GET /v1/rooms
 * - Follow the schema exactly from openapi.yaml
 * - Malformed ID must lead to 400 (Bad Request), not 404
 * ============================================================================
 */

// TODO (Person 2): Implement validation functions
// e.g., validateRoomId(id), validateListRoomsQuery(query)

function validateRoomId(id) {
  if (typeof id !== 'string' || !/^rm_[A-Za-z0-9]{3,}$/.test(id)) {
    const error = new Error('Invalid room ID');
    error.status = 400;
    throw error;
  }

  return id;
}

function validateListRoomsQuery(query) {
  if (!query || typeof query !== 'object') {
    return {};
  }

  const allowedParams = [];

  for (const key of Object.keys(query)) {
    if (!allowedParams.includes(key)) {
      const error = new Error(`Unknown query parameter: ${key}`);
      error.status = 400;
      throw error;
    }
  }

  return query;
}

module.exports = {
  validateRoomId,
  validateListRoomsQuery,
};