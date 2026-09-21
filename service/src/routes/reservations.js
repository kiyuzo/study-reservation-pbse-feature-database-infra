/**
 * ============================================================================
 * RESERVATION ROUTES
 * Owned by: PERSON 3 (Reservation Resource)
 * ============================================================================
 * Responsibilities:
 * - GET /v1/reservations
 * - GET /v1/reservations/:reservationId
 * - POST /v1/reservations
 * - POST /v1/reservations/:reservationId/cancellation
 *
 * Rules:
 * - Request validation
 * - Idempotency-Key for reservation creation
 * - Scope checks before protected operations
 * - Ownership checks before object access or mutation
 * - Never return raw DB rows
 * ============================================================================
 */

const express = require('express');
const crypto = require('crypto');

const { requireScope } = require('../auth/require-scope');

const {
  canAccessObject,
  sendObjectAccessDenied
} = require('../auth/ownership');

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
  cancelReservation,
  checkInReservation
} = require('../store/reservations');

const {
  toReservationRepresentation,
  toCancellationRepresentation
} = require('../representations/reservations');

const router = express.Router();

function hashRequestBody(body) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex');
}

// -----------------------------------------------------------------------------
// POST /v1/reservations
// -----------------------------------------------------------------------------

router.post(
  '/',
  requireScope('reservations:create'),
  (req, res, next) => {
    try {
      // 1. Validate Idempotency-Key.
      const idempotencyKey = req.get('Idempotency-Key');

      if (
        typeof idempotencyKey !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          idempotencyKey
        )
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

      // 3. Check idempotency key.
      const existingKey = findIdempotencyKey(idempotencyKey);

      if (existingKey) {
        if (existingKey.request_hash !== requestHash) {
          const error = new Error(
            'Idempotency-Key has already been used with a different request body.'
          );

          error.status = 409;
          error.type =
            'https://api.library.example/problems/idempotency-key-reuse';
          error.title =
            'Idempotency-Key has already been used with a different request body';

          throw error;
        }

        // Replay original response.
        const savedResponse = JSON.parse(existingKey.response_body);

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

      // 4. Verify room exists.
      const room = findRoomById(roomId);

      if (!room) {
        const error = new Error('Room not found.');
        error.status = 422;
        error.fields = {
          roomId: 'The specified room does not exist.'
        };
        throw error;
      }

      // 5. Check reservation conflict.
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
        error.type =
          'https://api.library.example/problems/room-unavailable';
        error.title =
          'The room is already reserved for the requested time';

        throw error;
      }

      // 6. Create reservation with authenticated owner.
      const id = `rsv_${Math.random().toString(36).slice(2, 10)}`;
      const createdAt = new Date().toISOString();

      const reservation = createReservation({
        id,
        roomId,
        date,
        startTime,
        endTime,
        status: 'pending_checkin',
        createdAt,
        ownerSubject: req.principal.subject
      });

      const representation =
        toReservationRepresentation(reservation);

      // 7. Save idempotency response.
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

      // 8. Return created reservation.
      res
        .status(201)
        .location(`${req.baseUrl}/${id}`)
        .json(representation);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /v1/reservations
// -----------------------------------------------------------------------------

router.get(
  '/',
  requireScope('reservations:read'),
  (req, res, next) => {
    try {
      const query = validateListReservationsQuery(req.query);

      const limit = query.limit !== undefined
        ? Number(query.limit)
        : 20;

      const reservations = findAllReservations({
        status: query.status,
        limit,
        cursor: query.cursor
      });

      const items = reservations.map(
        toReservationRepresentation
      );

      const nextCursor = reservations.length === limit
        ? reservations[reservations.length - 1].id
        : undefined;

      res.status(200).json({
        items,
        ...(nextCursor ? { nextCursor } : {})
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /v1/reservations/:reservationId
// -----------------------------------------------------------------------------

router.get(
  '/:reservationId',
  requireScope('reservations:read'),
  (req, res, next) => {
    try {
      // 1. Validate identifier.
      const reservationId = validateReservationId(
        req.params.reservationId
      );

      // 2. Retrieve reservation.
      const reservation = findReservationById(reservationId);

      // 3. Return 404 if reservation does not exist.
      if (!reservation) {
        const error = new Error('Reservation not found');
        error.status = 404;
        throw error;
      }

      // 4. Verify ownership before returning the resource.
      if (!canAccessObject(req.principal, reservation)) {
        return sendObjectAccessDenied(
          res,
          req,
          reservationId
        );
      }

      // 5. Convert DB row to API representation.
      const representation =
        toReservationRepresentation(reservation);

      // 6. Return response.
      res.status(200).json(representation);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /v1/reservations/:reservationId/cancellation
// -----------------------------------------------------------------------------

router.post(
  '/:reservationId/cancellation',
  requireScope('reservations:cancel'),
  (req, res, next) => {
    try {
      // 1. Validate reservation ID.
      const reservationId = validateReservationId(
        req.params.reservationId
      );

      // 2. Retrieve reservation.
      const reservation = findReservationById(reservationId);

      // 3. Return 404 if reservation does not exist.
      if (!reservation) {
        const error = new Error('Reservation not found');
        error.status = 404;
        throw error;
      }

      // 4. Verify ownership before any state check or write.
      if (!canAccessObject(req.principal, reservation)) {
        return sendObjectAccessDenied(
          res,
          req,
          reservationId
        );
      }

      // 5. Validate cancellation body.
      validateCancellation(req.body);

      // 6. If already cancelled, return existing result.
      if (reservation.status === 'cancelled') {
        const representation =
          toCancellationRepresentation(reservation);

        res.status(200).json(representation);
        return;
      }

      // 7. Only pending_checkin reservations can be cancelled.
      if (reservation.status !== 'pending_checkin') {
        const error = new Error(
          `${reservationId} is ${reservation.status}; cancellation is refused.`
        );

        error.status = 409;
        error.type =
          'https://api.library.example/problems/illegal-transition';
        error.title = 'That status change is not permitted';
        error.from = reservation.status;
        error.to = 'cancelled';
        error.allowedFrom = ['pending_checkin'];

        throw error;
      }

      // 8. Cancel reservation.
      const cancelReason = req.body.reason;

      const cancelledReservation = cancelReservation(
        reservationId,
        cancelReason
      );

      // 9. Convert to API representation.
      const representation =
        toCancellationRepresentation(cancelledReservation);

      // 10. Return cancellation response.
      res.status(201).json(representation);
    } catch (err) {
      next(err);
    }
  }
);


// POST /v1/reservations/:reservationId/check-in
router.post(
  ['/:reservationId/check-in', '/:reservationId/checkin'],
  requireScope('reservations:checkin'),
  (req, res, next) => {
    try {
      const reservationId = validateReservationId(
        req.params.reservationId
      );

      const reservation = findReservationById(reservationId);

      if (!reservation) {
        const error = new Error('Reservation not found');
        error.status = 404;
        throw error;
      }

      if (!canAccessObject(req.principal, reservation)) {
        return sendObjectAccessDenied(res, req, reservationId);
      }

      if (reservation.status !== 'pending_checkin') {
        const error = new Error('Reservation cannot be checked in.');
        error.status = 409;
        throw error;
      }

      const checkedInReservation = checkInReservation(reservationId);

      res.status(200).json(toReservationRepresentation(checkedInReservation));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;