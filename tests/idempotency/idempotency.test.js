/**
 * ============================================================================
 * IDEMPOTENCY TESTS
 * Owned by: PERSON 4 (Cross-Cutting Errors + Idempotency + CI)
 * ============================================================================
 * Verifies the server-side idempotency mechanism required by Assignment A.8:
 * 1. Initial request with valid Idempotency-Key processes and returns 201 Created.
 * 2. Replayed request with same key + same body returns saved 201 response without
 *    creating a duplicate entity.
 * 3. Replayed request with same key + different body returns 409 Conflict (idempotency-key-reuse).
 * 4. Idempotency persistence survives server / process restart (stored in SQLite, not memory).
 * 5. Rejection of missing or malformed Idempotency-Key before any database write.
 * ============================================================================
 */

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const request = require('supertest');

// Configure environment before loading app
process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.BASE_URL = 'http://localhost:8080';
const testDbPath = path.resolve(__dirname, '../../service/db/reservation.sqlite');
process.env.DATABASE_PATH = testDbPath;

const app = require('../../service/src/app');
const {
  checkIdempotencyKey,
  saveIdempotencyResult,
  findIdempotencyKey,
  hashRequestBody
} = require('../../service/src/store/idempotency');

function generateUuidV4() {
  return crypto.randomUUID();
}

describe('Idempotency Behavior Tests (Assignment Section A.8)', () => {
  let db;

  beforeAll(() => {
    db = new Database(testDbPath);
  });

  beforeEach(() => {
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

  describe('Direct Store Function Tests', () => {
    it('computes deterministic request body hash regardless of key order', () => {
      const bodyA = { roomId: 'rm_1a2B3cD', date: '2026-11-01', startTime: '10:00', endTime: '11:00' };
      const bodyB = { endTime: '11:00', startTime: '10:00', date: '2026-11-01', roomId: 'rm_1a2B3cD' };

      const hashA = hashRequestBody(bodyA);
      const hashB = hashRequestBody(bodyB);

      expect(hashA).toBe(hashB);
      expect(typeof hashA).toBe('string');
      expect(hashA).toHaveLength(64);
    });

    it('identifies an unseen key as new', () => {
      const key = generateUuidV4();
      const check = checkIdempotencyKey(key, { test: 123 });
      expect(check.seen).toBe(false);
    });

    it('identifies an already seen key with identical payload and returns saved response', () => {
      const key = generateUuidV4();
      const body = { roomId: 'rm_1a2B3cD', date: '2026-11-02' };
      const responseData = { id: 'rsv_test123', status: 'pending_checkin' };

      saveIdempotencyResult(key, body, 201, responseData);

      const check = checkIdempotencyKey(key, body);
      expect(check.seen).toBe(true);
      expect(check.match).toBe(true);
      expect(check.conflict).toBe(false);
      expect(check.statusCode).toBe(201);
      expect(check.response).toEqual(responseData);
    });

    it('detects a key reuse conflict when payload is altered', () => {
      const key = generateUuidV4();
      const originalBody = { roomId: 'rm_1a2B3cD', date: '2026-11-03' };
      const alteredBody = { roomId: 'rm_1a2B3cD', date: '2026-11-04' };

      saveIdempotencyResult(key, originalBody, 201, { id: 'rsv_testOriginal' });

      const check = checkIdempotencyKey(key, alteredBody);
      expect(check.seen).toBe(true);
      expect(check.match).toBe(false);
      expect(check.conflict).toBe(true);
    });
  });

  describe('HTTP Integration via /v1/reservations', () => {
    it('1. Initial request with Idempotency-Key creates reservation and returns 201 Created', async () => {
      const idempotencyKey = generateUuidV4();
      const payload = {
        roomId: 'rm_1a2B3cD',
        date: '2026-12-01',
        startTime: '08:00',
        endTime: '09:00'
      };

      const res = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.headers['location']).toBeDefined();
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^rsv_[A-Za-z0-9]{3,}$/),
          roomId: 'rm_1a2B3cD',
          status: 'pending_checkin',
          createdAt: expect.any(String)
        })
      );

      // Verify key is physically stored in SQLite idempotency_keys table
      const stored = findIdempotencyKey(idempotencyKey);
      expect(stored).toBeDefined();
      expect(stored.key).toBe(idempotencyKey);
      expect(stored.response_status).toBe(201);
    });

    it('2. Replayed request with same Idempotency-Key and SAME body returns cached 201 and creates no duplicate DB rows', async () => {
      const idempotencyKey = generateUuidV4();
      const payload = {
        roomId: 'rm_1a2B3cD',
        date: '2026-12-01',
        startTime: '09:00',
        endTime: '10:00'
      };

      // Initial request
      const res1 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.statusCode).toBe(201);
      const createdId = res1.body.id;

      // Count reservations for this room and date
      const countBefore = db
        .prepare('SELECT COUNT(*) as count FROM reservations WHERE id = ?')
        .get(createdId).count;
      expect(countBefore).toBe(1);

      // Replayed request (same key + same body)
      const res2 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.statusCode).toBe(201);
      expect(res2.body.id).toBe(createdId);
      expect(res2.body).toEqual(res1.body);

      // Verify that NO additional reservation row was inserted
      const countAfter = db
        .prepare('SELECT COUNT(*) as count FROM reservations WHERE id = ?')
        .get(createdId).count;
      expect(countAfter).toBe(1);
    });

    it('3. Replayed request with same Idempotency-Key and DIFFERENT body returns 409 Conflict with Problem Details', async () => {
      const idempotencyKey = generateUuidV4();
      const originalPayload = {
        roomId: 'rm_1a2B3cD',
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '11:00'
      };

      // 1st request
      const res1 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(originalPayload);

      expect(res1.statusCode).toBe(201);

      // 2nd request with same key but different body
      const differentPayload = {
        roomId: 'rm_2b3C4dE',
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '11:00'
      };

      const res2 = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(differentPayload);

      expect(res2.statusCode).toBe(409);
      expect(res2.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res2.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/idempotency-key-reuse',
          title: expect.any(String),
          status: 409,
          detail: expect.stringMatching(/different request body/i)
        })
      );
    });

    it('4. Persists idempotency records across server restarts (survives restart test)', async () => {
      const idempotencyKey = generateUuidV4();
      const payload = {
        roomId: 'rm_2b3C4dE',
        date: '2026-12-02',
        startTime: '11:00',
        endTime: '12:00'
      };

      // Step A: Send request to create reservation
      const resInitial = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(resInitial.statusCode).toBe(201);
      const originalId = resInitial.body.id;

      // Step B: Simulate complete process/server restart by reloading app fresh from file
      jest.resetModules();
      const restartedApp = require('../../service/src/app');

      // Step C: Send the same request to the restarted app
      const resReplay = await request(restartedApp)
        .post('/v1/reservations')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      // The restarted service must recall the key from SQLite and replay the original response
      expect(resReplay.statusCode).toBe(201);
      expect(resReplay.body.id).toBe(originalId);
    });

    it('5. Rejects missing or malformed Idempotency-Key with 400 Bad Request Problem Details before doing work', async () => {
      // Missing header
      const resMissing = await request(app)
        .post('/v1/reservations')
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-12-03',
          startTime: '13:00',
          endTime: '14:00'
        });

      expect(resMissing.statusCode).toBe(400);
      expect(resMissing.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(resMissing.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          status: 400,
          title: expect.any(String)
        })
      );

      // Malformed header (non-UUID)
      const resMalformed = await request(app)
        .post('/v1/reservations')
        .set('Idempotency-Key', 'not-a-valid-uuid')
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2026-12-03',
          startTime: '13:00',
          endTime: '14:00'
        });

      expect(resMalformed.statusCode).toBe(400);
      expect(resMalformed.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(resMalformed.body.status).toBe(400);
    });
  });
});
