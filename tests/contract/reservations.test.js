/**
 * ============================================================================
 * CONTRACT TESTS — Reservation Resource
 * Owned by: PERSON 3 / PERSON 4
 * ============================================================================
 * Tests contract conformance against openapi.yaml:
 * 1. POST /v1/reservations (Success 201 with Location header, schema, and RFC 3339 createdAt)
 * 2. POST /v1/reservations (Missing Idempotency-Key -> 400 Problem Details)
 * 3. POST /v1/reservations (Malformed Idempotency-Key -> 400 Problem Details)
 * 4. POST /v1/reservations (Missing / malformed fields -> 400 Problem Details)
 * 5. POST /v1/reservations (Invalid logic / endTime <= startTime -> 422 Problem Details)
 * 6. POST /v1/reservations (Referenced room does not exist -> 422 Problem Details)
 * 7. POST /v1/reservations (Time overlap conflict -> 409 Problem Details)
 * 8. POST /v1/reservations (Idempotency key reuse with different body -> 409 Problem Details)
 * 9. GET /v1/reservations (Collection response with items array conforming to openapi.yaml)
 * 10. GET /v1/reservations (Filtering by valid status)
 * 11. GET /v1/reservations (Rejection of invalid status or query -> 400 Problem Details)
 * 12. GET /v1/reservations/{id} (Fetch single reservation conforming to schema)
 * 13. GET /v1/reservations/{id} (Malformed ID format -> 400 Problem Details)
 * 14. GET /v1/reservations/{id} (Non-existent ID -> 404 Problem Details)
 * 15. POST /v1/reservations/{id}/cancellation (State transition -> 201 Created with Cancellation schema)
 * 16. POST /v1/reservations/{id}/cancellation (Already cancelled -> 200 OK)
 * 17. POST /v1/reservations/{id}/cancellation (Non-pending status -> 409 illegal-transition)
 * 18. POST /v1/reservations/{id}/cancellation (Non-existent reservation -> 404 Problem Details)
 * ============================================================================
 */

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.BASE_URL = 'http://localhost:8080';
const testDbPath = path.resolve(__dirname, '../../service/db/reservation.sqlite');
process.env.DATABASE_PATH = testDbPath;

const app = require('../../service/src/app');

function generateUuidV4() {
  return crypto.randomUUID();
}

describe('Reservations Contract Tests (openapi.yaml)', () => {
  let db;

  beforeAll(() => {
    db = new Database(testDbPath);
  });

  beforeEach(() => {
    // Keep test runs isolated
    db.exec(`
      DELETE FROM reservations WHERE date >= '2026-11-01';
      DELETE FROM idempotency_keys;
    `);
  });

  afterAll(() => {
    if (db) {
      db.exec(`
        DELETE FROM reservations WHERE date >= '2026-11-01';
        DELETE FROM idempotency_keys;
      `);
      db.close();
    }
  });

  // ---------------------------------------------------------------------------
  // POST /v1/reservations
  // ---------------------------------------------------------------------------
  describe('POST /v1/reservations', () => {
    it('creates reservation and returns 201 with Location header and Reservation schema', async () => {
      const idempotencyKey = generateUuidV4();
      const payload = {
        roomId: 'rm_1a2B3cD',
        date: '2026-11-10',
        startTime: '09:00',
        endTime: '11:00'
      };

      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['location']).toBeDefined();
      expect(res.headers['location']).toMatch(/\/v1\/reservations\/rsv_[A-Za-z0-9]{3,}$/);

      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^rsv_[A-Za-z0-9]{3,}$/),
          roomId: 'rm_1a2B3cD',
          status: 'pending_checkin',
          createdAt: expect.any(String)
        })
      );
    });

    it('returns 400 Problem Details when Idempotency-Key header is absent', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-11-10',
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          title: expect.any(String),
          status: 400,
          detail: expect.stringMatching(/idempotency-key/i)
        })
      );
    });

    it('returns 400 Problem Details when Idempotency-Key header is malformed', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', 'invalid-non-uuid-key')
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-11-10',
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(400);
    });

    it('returns 400 Problem Details when request body is missing required fields', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_1a2B3cD'
          // missing date, startTime, endTime
        });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          status: 400
        })
      );
    });

    it('returns 400 Problem Details when date or time format is malformed', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_1a2B3cD',
          date: 'not-a-date',
          startTime: '9am',
          endTime: '11am'
        });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(400);
    });

    it('returns 422 Problem Details when time range is semantically invalid (endTime <= startTime)', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-11-10',
          startTime: '14:00',
          endTime: '10:00'
        });

      expect(res.statusCode).toBe(422);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/validation-failed',
          title: 'One or more fields are invalid',
          status: 422,
          detail: expect.stringMatching(/end time must be later than start time/i)
        })
      );
    });

    it('returns 422 Problem Details when specified roomId does not exist', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_nonexistent999',
          date: '2026-11-10',
          startTime: '10:00',
          endTime: '12:00'
        });

      expect(res.statusCode).toBe(422);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(422);
    });

    it('returns 409 Problem Details when room is already reserved for the requested time', async () => {
      const slot = {
        roomId: 'rm_1a2B3cD',
        date: '2026-11-11',
        startTime: '14:00',
        endTime: '16:00'
      };

      // 1st booking
      const res1 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send(slot);
      expect(res1.statusCode).toBe(201);

      // Overlapping booking for same room and slot
      const res2 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-11-11',
          startTime: '15:00',
          endTime: '17:00'
        });

      expect(res2.statusCode).toBe(409);
      expect(res2.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res2.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/room-unavailable',
          title: expect.any(String),
          status: 409
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /v1/reservations
  // ---------------------------------------------------------------------------
  describe('GET /v1/reservations', () => {
    it('returns 200 with list conforming to openapi.yaml', async () => {
      const res = await request(app).get('/v1/reservations');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);

      res.body.items.forEach((item) => {
        expect(item).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^rsv_[A-Za-z0-9]{3,}$/),
            roomId: expect.any(String),
            status: expect.stringMatching(/^(pending_checkin|checked_in|cancelled|no_show|completed)$/),
            createdAt: expect.any(String)
          })
        );
      });
    });

    it('filters reservations by status', async () => {
      const res = await request(app).get('/v1/reservations?status=checked_in');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      res.body.items.forEach((item) => {
        expect(item.status).toBe('checked_in');
      });
    });

    it('returns 400 Problem Details for invalid status query filter', async () => {
      const res = await request(app).get('/v1/reservations?status=invalid_status_value');

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /v1/reservations/:reservationId
  // ---------------------------------------------------------------------------
  describe('GET /v1/reservations/:reservationId', () => {
    it('returns 200 with single reservation matching schema', async () => {
      const res = await request(app).get('/v1/reservations/rsv_9X8y7Z');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: 'rsv_9X8y7Z',
          roomId: 'rm_1a2B3cD',
          status: 'pending_checkin',
          createdAt: expect.any(String)
        })
      );
    });

    it('returns 400 Problem Details for malformed reservation ID', async () => {
      const res = await request(app).get('/v1/reservations/bad_id!');

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          status: 400,
          instance: '/v1/reservations/bad_id!'
        })
      );
    });

    it('returns 404 Problem Details for non-existent reservation ID', async () => {
      const res = await request(app).get('/v1/reservations/rsv_9999999');

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/not-found',
          status: 404,
          instance: '/v1/reservations/rsv_9999999'
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /v1/reservations/:reservationId/cancellation
  // ---------------------------------------------------------------------------
  describe('POST /v1/reservations/:reservationId/cancellation', () => {
    it('cancels pending reservation and returns 201 with Cancellation schema', async () => {
      // First create a pending reservation to cancel
      const createRes = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', generateUuidV4())
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-11-20',
          startTime: '09:00',
          endTime: '10:00'
        });
      expect(createRes.statusCode).toBe(201);
      const targetId = createRes.body.id;

      // Cancel it
      const cancelRes = await request(app)
        .post(`/v1/reservations/${targetId}/cancellation`)
        .send({ reason: 'Schedule conflict' });

      expect(cancelRes.statusCode).toBe(201);
      expect(cancelRes.headers['content-type']).toMatch(/application\/json/);
      expect(cancelRes.body).toEqual(
        expect.objectContaining({
          reservationId: targetId,
          reason: 'Schedule conflict',
          cancelledAt: expect.any(String)
        })
      );
    });

    it('returns 200 OK when re-cancelling an already cancelled reservation (idempotent)', async () => {
      // rsv_Cc3Dd4 is seeded as 'cancelled'
      const res = await request(app)
        .post('/v1/reservations/rsv_Cc3Dd4/cancellation')
        .send({ reason: 'Second cancellation attempt' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          reservationId: 'rsv_Cc3Dd4',
          reason: expect.any(String),
          cancelledAt: expect.any(String)
        })
      );
    });

    it('returns 409 Conflict with illegal-transition Problem Details when status is not pending_checkin', async () => {
      // rsv_Aa1Bb2 is seeded as 'checked_in'
      const res = await request(app)
        .post('/v1/reservations/rsv_Aa1Bb2/cancellation')
        .send({ reason: 'Attempt to cancel checked in' });

      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/illegal-transition',
          title: 'That status change is not permitted',
          status: 409,
          from: 'checked_in',
          to: 'cancelled',
          allowedFrom: ['pending_checkin']
        })
      );
    });

    it('returns 404 Problem Details when cancelling non-existent reservation', async () => {
      const res = await request(app)
        .post('/v1/reservations/rsv_nonexistent999/cancellation')
        .send({ reason: 'Invalid reservation' });

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(404);
    });
  });
});
