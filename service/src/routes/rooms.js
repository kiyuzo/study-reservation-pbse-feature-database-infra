/**
 * ============================================================================
 * STUDY ROOM ROUTES
 * Owned by: PERSON 2 (Study Room Resource)
 * ============================================================================
 * Responsibilities (Pages 2-4):
 * - GET /v1/rooms
 * - GET /v1/rooms/{id}
 * 
 * Rules:
 * - Connect endpoints to handlers.
 * - Call validation in schemas/rooms.js.
 * - Malformed ID -> 400, not 404.
 * - Call store/rooms.js for database access.
 * - Return representations via representations/rooms.js (never raw DB rows).
 * - Empty collection: 200 + [], not 404.
 * ============================================================================
 */

const express = require('express');

const {
  validateRoomId,
  validateListRoomsQuery
} = require('../schemas/rooms');

const {
  findAllRooms,
  findRoomById
} = require('../store/rooms');

const {
  toRoomRepresentation
} = require('../representations/rooms');

const { requireScope } = require('../auth/require-scope');
const {
  computeCollectionEtag,
  computeEntityEtag,
  matchesEtag
} = require('../utils/etags');

const router = express.Router();

// GET /v1/rooms
router.get('/', requireScope('rooms:read'), (req, res, next) => {
  try {
    validateListRoomsQuery(req.query);

    const rooms = findAllRooms();
    const representation = rooms.map(toRoomRepresentation);
    const etag = computeCollectionEtag(representation, 'rooms');

    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');

    const ifNoneMatch = req.get('If-None-Match');
    if (matchesEtag(ifNoneMatch, etag)) {
      return res.status(304).end();
    }

    res.status(200).json(representation);
  } catch (err) {
    next(err);
  }
});

// GET /v1/rooms/:roomId
router.get('/:roomId', requireScope('rooms:read'), (req, res, next) => {
  try {
    const roomId = validateRoomId(req.params.roomId);

    const room = findRoomById(roomId);

    if (!room) {
      const error = new Error('Room not found');
      error.status = 404;
      throw error;
    }

    const representation = toRoomRepresentation(room);
    const etag = computeEntityEtag(representation, 'room');

    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');

    const ifNoneMatch = req.get('If-None-Match');
    if (matchesEtag(ifNoneMatch, etag)) {
      return res.status(304).end();
    }

    res.status(200).json(representation);
  } catch (err) {
    next(err);
  }
});

module.exports = router;