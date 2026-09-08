/**
 * ============================================================================
 * RESERVATION VALIDATION SCHEMAS
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 * Responsibilities (Pages 5-6):
 * - Validate reservationId format ('^rsv_[A-Za-z0-9]{3,}$') -> 400 if malformed
 * - Validate query parameters for GET /v1/reservations (status enum, limit, cursor)
 * - Validate POST /v1/reservations body (roomId, date, startTime, endTime)
 *   - Well-formed checks -> 400
 *   - Semantic/business constraints -> 422 (e.g., endTime <= startTime)
 * ============================================================================
 */

// TODO (Person 3): Implement validation logic for reservations

/**
 * ============================================================================
 * RESERVATION VALIDATION SCHEMAS
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 */

const RESERVATION_ID_REGEX = /^rsv_[A-Za-z0-9]{3,}$/;

const VALID_STATUSES = [
  'pending_checkin',
  'checked_in',
  'cancelled',
  'no_show',
  'completed'
];

function createValidationError(message, fields = {}) {
  const error = new Error(message);
  error.status = 400;
  error.fields = fields;
  return error;
}

// -----------------------------------------------------------------------------
// Validate reservation ID
// Contract: ^rsv_[A-Za-z0-9]{3,}$
// Malformed ID -> 400
// -----------------------------------------------------------------------------

function validateReservationId(reservationId) {
  if (
    typeof reservationId !== 'string' ||
    !RESERVATION_ID_REGEX.test(reservationId)
  ) {
    throw createValidationError(
      'Invalid reservation ID format.',
      {
        reservationId: 'Must match ^rsv_[A-Za-z0-9]{3,}$.'
      }
    );
  }

  return reservationId;
}

// -----------------------------------------------------------------------------
// Validate GET /v1/reservations query parameters
// -----------------------------------------------------------------------------

function validateListReservationsQuery(query) {
  const errors = {};

  if (query.status !== undefined) {
    if (!VALID_STATUSES.includes(query.status)) {
      errors.status = `Must be one of: ${VALID_STATUSES.join(', ')}.`;
    }
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      errors.limit = 'Must be an integer between 1 and 100.';
    }
  }

  if (query.cursor !== undefined) {
    if (
      typeof query.cursor !== 'string' ||
      query.cursor.trim() === ''
    ) {
      errors.cursor = 'Must be a non-empty string.';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw createValidationError(
      'Invalid reservation query parameters.',
      errors
    );
  }

  return query;
}

// -----------------------------------------------------------------------------
// Validate POST /v1/reservations body
// -----------------------------------------------------------------------------

function validateCreateReservation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createValidationError(
      'Request body must be an object.'
    );
  }

  const errors = {};

  // ---------------------------------------------------------------------------
  // Required fields
  // ---------------------------------------------------------------------------

  if (
    typeof body.roomId !== 'string' ||
    body.roomId.trim() === ''
  ) {
    errors.roomId = 'Room ID is required.';
  }

  if (
    typeof body.date !== 'string' ||
    body.date.trim() === ''
  ) {
    errors.date = 'Date is required.';
  }

  if (
    typeof body.startTime !== 'string' ||
    body.startTime.trim() === ''
  ) {
    errors.startTime = 'Start time is required.';
  }

  if (
    typeof body.endTime !== 'string' ||
    body.endTime.trim() === ''
  ) {
    errors.endTime = 'End time is required.';
  }

  // If required fields are missing/malformed, return 400.
  if (Object.keys(errors).length > 0) {
    throw createValidationError(
      'Invalid reservation request body.',
      errors
    );
  }

  // ---------------------------------------------------------------------------
  // Date format
  // Contract example: 2026-08-31
  // ---------------------------------------------------------------------------

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.date = 'Must use YYYY-MM-DD format.';
  }

  // ---------------------------------------------------------------------------
  // Time format
  // Contract example: 14:00
  // ---------------------------------------------------------------------------

  if (!/^\d{2}:\d{2}$/.test(body.startTime)) {
    errors.startTime = 'Must use HH:MM format.';
  }

  if (!/^\d{2}:\d{2}$/.test(body.endTime)) {
    errors.endTime = 'Must use HH:MM format.';
  }

  // ---------------------------------------------------------------------------
  // Validate actual hour/minute ranges
  // ---------------------------------------------------------------------------

  if (/^\d{2}:\d{2}$/.test(body.startTime)) {
    const [hours, minutes] = body.startTime.split(':').map(Number);

    if (hours > 23 || minutes > 59) {
      errors.startTime = 'Must be a valid time between 00:00 and 23:59.';
    }
  }

  if (/^\d{2}:\d{2}$/.test(body.endTime)) {
    const [hours, minutes] = body.endTime.split(':').map(Number);

    if (hours > 23 || minutes > 59) {
      errors.endTime = 'Must be a valid time between 00:00 and 23:59.';
    }
  }

  // ---------------------------------------------------------------------------
  // Return 400 for malformed fields
  // ---------------------------------------------------------------------------

  if (Object.keys(errors).length > 0) {
    throw createValidationError(
      'Invalid reservation request body.',
      errors
    );
  }

  // ---------------------------------------------------------------------------
  // Semantic/business validation
  // endTime must be later than startTime -> 422
  // ---------------------------------------------------------------------------

  if (body.endTime <= body.startTime) {
    const error = new Error(
      'End time must be later than start time.'
    );

    error.status = 422;
    error.fields = {
      endTime: 'Must be later than startTime.'
    };

    throw error;
  }

  return body;
}

function validateCancellation(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw createValidationError(
      'Request body must be an object.'
    );
  }

  const errors = {};

  if (typeof body.reason !== 'string') {
  errors.reason = 'Reason must be a string.';
  }

  if (Object.keys(errors).length > 0) {
    throw createValidationError(
      'Invalid cancellation request body.',
      errors
    );
  }

  return body;
}

module.exports = {
  validateReservationId,
  validateListReservationsQuery,
  validateCreateReservation,
  validateCancellation
};