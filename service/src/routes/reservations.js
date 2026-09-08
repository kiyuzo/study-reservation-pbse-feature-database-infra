/**
 * ============================================================================
 * RESERVATION ROUTES
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 * Responsibilities (Pages 4-6):
 * - GET /v1/reservations (collection read with status filter)
 * - GET /v1/reservations/:reservationId (single entity read)
 * - POST /v1/reservations (unsafe write operation with Idempotency-Key)
 * - POST /v1/reservations/:reservationId/cancellation (state transition)
 * 
 * Rules:
 * - Request validation (schemas/reservations.js)
 * - Idempotency integration (Dependency 1: calls Person 4's store/idempotency.js)
 * - Status code precision:
 *   - 400: Malformed request
 *   - 422: Valid structure but semantically unusable (e.g. end <= start)
 *   - 409: Domain conflict (room already booked) or idempotency mismatch
 *   - 201: Created, includes Location header
 * - Never return raw DB rows; map through representations/reservations.js
 * ============================================================================
 */

const express = require('express');
const crypto = require('crypto');

const {
  validateReservationId,
  validateListReservationsQuery,
  validateCreateReservation,
  validateCancellation
} = require('../schemas/reservations');

const {
  findReservationById,
  findAllReservations,
  findRoomById,
  findConflictingReservation,
  createReservation,
  findIdempotencyKey,
  saveIdempotencyKey,
  cancelReservation
} = require('../store/reservations');

const {
  toReservationRepresentation,
  toCancellationRepresentation
} = require('../representations/reservations');

function hashRequestBody(body) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex');
}

const router = express.Router();

// -----------------------------------------------------------------------------
// POST /v1/reservations
// -----------------------------------------------------------------------------

router.post('/', (req, res, next) => {
  try {
    // 1. Validate Idempotency-Key before doing any database work.
    const idempotencyKey = req.get('Idempotency-Key');

    if (
      typeof idempotencyKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    ) {
      const error = new Error(
        'A valid Idempotency-Key header is required.'
      );
      error.status = 400;
      throw error;
    }

    // 2. Validate request body.
    validateCreateReservation(req.body);

    const requestHash = hashRequestBody(req.body);

    // 3. Check whether this idempotency key was used before.
    const existingKey = findIdempotencyKey(idempotencyKey);

    if (existingKey) {
      // Same key but different request body -> conflict.
      if (existingKey.request_hash !== requestHash) {
        const error = new Error(
          'Idempotency-Key has already been used with a different request body.'
        );
        error.status = 409;
        error.type = 'https://api.library.example/problems/idempotency-key-reuse';
        error.title = 'Idempotency-Key has already been used with a different request body';
        throw error;
      }

      // Same key + same body -> replay the original response.
      const savedResponse =
        JSON.parse(existingKey.response_body);

      res
        .status(existingKey.response_status)
        .location(`${req.baseUrl}/${savedResponse.id}`)
        .json(savedResponse);

      return;
    }

    const {
      roomId,
      date,
      startTime,
      endTime
    } = req.body;

    // 4. Check that the requested room exists.
    const room = findRoomById(roomId);

    if (!room) {
      const error = new Error('Room not found.');
      error.status = 422;
      error.fields = {
        roomId: 'The specified room does not exist.'
      };
      throw error;
    }

    // 5. Check for an overlapping reservation.
    const conflict = findConflictingReservation(
      roomId,
      date,
      startTime,
      endTime
    );

    if (conflict) {
      const error = new Error(
        'The room is already reserved for the requested time.'
      );
      error.status = 409;
      error.type = 'https://api.library.example/problems/room-unavailable';
      error.title = 'The room is already reserved for the requested time';
      throw error;
    }

    // 6. Create the reservation.
    const id = `rsv_${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = new Date().toISOString();

    const reservation = createReservation({
      id,
      roomId,
      date,
      startTime,
      endTime,
      status: 'pending_checkin',
      createdAt
    });

    const representation =
      toReservationRepresentation(reservation);

    // 7. Save the response for future idempotent replays.
    const responseBody = JSON.stringify(representation);

    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    saveIdempotencyKey({
      key: idempotencyKey,
      requestHash,
      responseStatus: 201,
      responseBody,
      createdAt,
      expiresAt
    });

    // 8. Return 201 Created.
    res
      .status(201)
      .location(`${req.baseUrl}/${id}`)
      .json(representation);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    // 1. Validate query parameters.
    const query = validateListReservationsQuery(req.query);

    // 2. Apply defaults from the OpenAPI contract.
    const limit = query.limit !== undefined
      ? Number(query.limit)
      : 20;

    // 3. Retrieve reservations from the database.
    const reservations = findAllReservations({
      status: query.status,
      limit,
      cursor: query.cursor
    });

    // 4. Convert DB rows into API representations.
    const items = reservations.map(
  toReservationRepresentation
);

// 5. Determine whether another page exists.
const nextCursor = reservations.length === limit
  ? reservations[reservations.length - 1].id
  : undefined;

// 6. Return collection response.
res.status(200).json({
  items,
  ...(nextCursor ? { nextCursor } : {})
});
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /v1/reservations/:reservationId
// -----------------------------------------------------------------------------

router.get('/:reservationId', (req, res, next) => {
  try {
    // 1. Validate identifier BEFORE database access.
    const reservationId = validateReservationId(
      req.params.reservationId
    );

    // 2. Retrieve reservation.
    const reservation = findReservationById(reservationId);

    // 3. Valid ID but reservation does not exist -> 404.
    if (!reservation) {
      const error = new Error('Reservation not found');
      error.status = 404;
      throw error;
    }

    // 4. Convert DB row to API representation.
    const representation =
      toReservationRepresentation(reservation);

    // 5. Return response.
    res.status(200).json(representation);
  } catch (err) {
    next(err);
  }
});

router.post('/:reservationId/cancellation', (req, res, next) => {
  try {
    // 1. Validate request body before database access.
    validateCancellation(req.body);

    // 2. Validate reservation ID before database access.
    const reservationId = req.params.reservationId;

    const reservation = findReservationById(reservationId);

    // 3. RSSeservation does not exist -> 404.
    if (!reservation) {
      const error = new Error('Reservation not found');
      error.status = 404;
      throw error;
    }

    // 4. If already cancelled, return the existing reservation.
    if (reservation.status === 'cancelled') {
        const representation =
            toCancellationRepresentation(reservation);

        res.status(200).json(representation);
        return;
    }

    // 5. Only pending_checkin reservations can be cancelled.
    if (reservation.status !== 'pending_checkin') {
      const error = new Error(
        `${reservationId} is ${reservation.status}; cancellation is refused.`
      );
      error.status = 409;
      error.type = 'https://api.library.example/problems/illegal-transition';
      error.title = 'That status change is not permitted';
      error.from = reservation.status;
      error.to = 'cancelled';
      error.allowedFrom = ['pending_checkin'];
      throw error;
    }

    // 6. Cancel the reservation.
    const cancelReason = req.body.reason;

    const cancelledReservation = cancelReservation(
      reservationId,
      cancelReason
    );

    // 7. Convert DB row to API representation.
    const representation =
        toCancellationRepresentation(cancelledReservation);

    // 8. Return 201 for a newly cancelled reservation.
    res.status(201).json(representation);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
