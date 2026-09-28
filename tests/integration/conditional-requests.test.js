/**
 * ============================================================================
 * INTEGRATION TESTS — Conditional Requests & Authorization (Nareswari Scope)
 * ============================================================================
 * Covers:
 * A. Conditional GET (ETag -> If-None-Match -> 304 Not Modified, empty body)
 * B. ETag changes on state change (ETag A != ETag B)
 * C. Conditional write (If-Match -> success, stale If-Match -> 412 Precondition Failed)
 * D. Authorization testing (401, 403 on missing scope, 404 on foreign reservation)
 * E. Existing functionality verification
 * ============================================================================
 */

const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');

process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.BASE_URL = 'http://localhost:8080';
const testDbPath = path.resolve(__dirname, '../../service/db/reservation.sqlite');
process.env.DATABASE_PATH = testDbPath;

const app = require('../../service/src/app');
const { mintToken } = require('../../service/src/auth/tokens');

describe('A.7 & A.8 Conditional Requests & A.9 Authorization Integration Tests', () => {
  let db;
  let studentAToken;
  let studentBToken;
  let studentLimitedToken;
  let adminToken;

  beforeAll(() => {
    db = new Database(testDbPath);

    studentAToken = mintToken({
      subject: 'student-a',
      scopes: [
        'rooms:read',
        'reservations:read',
        'reservations:create',
        'reservations:cancel',
        'reservations:checkin',
        'reservations:write'
      ]
    });

    studentBToken = mintToken({
      subject: 'student-b',
      scopes: [
        'rooms:read',
        'reservations:read',
        'reservations:create',
        'reservations:cancel',
        'reservations:write'
      ]
    });

    studentLimitedToken = mintToken({
      subject: 'student-limited',
      scopes: ['rooms:read']
    });

    adminToken = mintToken({
      subject: 'admin-user',
      scopes: [
        'rooms:read',
        'reservations:read',
        'reservations:create',
        'reservations:cancel',
        'reservations:checkin',
        'admin:manage'
      ]
    });
  });

  beforeEach(() => {
    // Reset reservations and ownership for reproducible test state
    db.exec(`
      UPDATE reservations
      SET status = 'pending_checkin',
          cancel_reason = NULL,
          cancelled_at = NULL,
          checked_in_at = NULL
      WHERE id IN ('rsv_9X8y7Z', 'rsv_Aa1Bb2', 'rsv_Cc3Dd4');

      INSERT OR REPLACE INTO reservation_owners (reservation_id, owner_subject)
      VALUES ('rsv_9X8y7Z', 'student-a');

      INSERT OR REPLACE INTO reservation_owners (reservation_id, owner_subject)
      VALUES ('rsv_Aa1Bb2', 'student-b');

      INSERT OR REPLACE INTO reservation_owners (reservation_id, owner_subject)
      VALUES ('rsv_Cc3Dd4', 'student-a');
    `);
  });

  afterAll(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // A. CONDITIONAL GET (COLLECTIONS & ENTITIES)
  // ---------------------------------------------------------------------------
  describe('A. Conditional GET (ETag + If-None-Match + 304)', () => {
    it('1-6: First GET returns 200 with ETag; second GET with If-None-Match returns 304 with no body', async () => {
      // 1. First GET /v1/rooms
      const res1 = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`);

      // 2. Assert 200
      expect(res1.statusCode).toBe(200);

      // 3. Assert ETag exists
      const etag = res1.headers['etag'];
      expect(etag).toBeDefined();
      expect(etag.length).toBeGreaterThan(0);
      expect(Array.isArray(res1.body)).toBe(true);

      // 4. Second GET with If-None-Match matching captured ETag
      const res2 = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-None-Match', etag);

      // 5. Assert 304 Not Modified
      expect(res2.statusCode).toBe(304);

      // 6. Assert no response body
      expect(res2.text).toBe('');
      expect(res2.body).toEqual({});
    });

    it('returns 304 on single reservation entity GET when If-None-Match matches', async () => {
      // First GET /v1/reservations/rsv_9X8y7Z
      const res1 = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res1.statusCode).toBe(200);
      const etag = res1.headers['etag'];
      expect(etag).toBeDefined();

      // Conditional GET with matching If-None-Match
      const res2 = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-None-Match', etag);

      expect(res2.statusCode).toBe(304);
      expect(res2.text).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // B. ETAG CHANGES ON DATA MODIFICATION
  // ---------------------------------------------------------------------------
  describe('B. ETag Changes on State Modification', () => {
    it('1-6: ETag changes after resource representation is updated (ETag A != ETag B)', async () => {
      // 1. GET resource
      const res1 = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res1.statusCode).toBe(200);
      // 2. Capture ETag A
      const etagA = res1.headers['etag'];
      expect(etagA).toBeDefined();

      // 3. Perform valid state-changing operation (cancellation)
      const cancelRes = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/cancellation')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-Match', etagA)
        .send({ reason: 'Need to reschedule' });

      expect(cancelRes.statusCode).toBe(201);

      // 4. GET resource again
      const res2 = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res2.statusCode).toBe(200);
      // 5. Capture ETag B
      const etagB = res2.headers['etag'];
      expect(etagB).toBeDefined();

      // 6. Verify ETag A != ETag B
      expect(etagA).not.toEqual(etagB);

      // Verify that sending stale ETag A now returns 200 instead of 304
      const resStale = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-None-Match', etagA);

      expect(resStale.statusCode).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // C. CONDITIONAL WRITES (IF-MATCH + 412 PRECONDITION FAILED)
  // ---------------------------------------------------------------------------
  describe('C. Conditional Writes (If-Match + 412 Precondition Failed)', () => {
    it('1-6: Valid write with correct If-Match succeeds; subsequent write with stale If-Match returns 412', async () => {
      // 1. GET entity
      const getRes = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(getRes.statusCode).toBe(200);

      // 2. Capture ETag
      const etagInitial = getRes.headers['etag'];
      expect(etagInitial).toBeDefined();

      // 3. Window A performs write with correct If-Match
      const writeA = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/checkin')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-Match', etagInitial);

      // 4. Assert success
      expect(writeA.statusCode).toBe(200);
      const etagUpdated = writeA.headers['etag'];
      expect(etagUpdated).toBeDefined();
      expect(etagUpdated).not.toEqual(etagInitial);

      // 5. Window B attempts write using stale initial ETag
      const writeB = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/cancellation')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-Match', etagInitial)
        .send({ reason: 'Concurrent cancellation attempt' });

      // 6. Assert 412 Precondition Failed with RFC 9457 Problem Details
      expect(writeB.statusCode).toBe(412);
      expect(writeB.headers['content-type']).toContain('application/problem+json');
      expect(writeB.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/precondition-failed',
          title: 'Precondition Failed',
          status: 412,
          detail: expect.stringContaining('already been updated')
        })
      );
    });

    it('rejects cancellation with 412 when If-Match is completely mismatched/stale', async () => {
      const res = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/cancellation')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('If-Match', '"rsv_9X8y7Z-stale-hash-9999"')
        .send({ reason: 'Test stale etag' });

      expect(res.statusCode).toBe(412);
      expect(res.body.status).toBe(412);
    });
  });

  // ---------------------------------------------------------------------------
  // D. AUTHORIZATION TESTS (A.9 REQUIREMENTS)
  // ---------------------------------------------------------------------------
  describe('D. Authorization Enforcement (A.9 Scenarios)', () => {
    it('1. Authenticated authorized user is permitted (200/201)', async () => {
      const res = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('rsv_9X8y7Z');
    });

    it('2. Authenticated user with missing scope receives 403 Forbidden (never 200)', async () => {
      // student-limited only has rooms:read; attempts to view security audit events (requires admin:manage)
      const res1 = await request(app)
        .get('/v1/security/events')
        .set('Authorization', `Bearer ${studentLimitedToken}`);

      expect(res1.statusCode).toBe(403);
      expect(res1.headers['content-type']).toContain('application/problem+json');
      expect(res1.body).toEqual(
        expect.objectContaining({
          status: 403,
          type: 'https://api.library.example/problems/forbidden'
        })
      );

      // student-limited attempts to cancel a reservation (requires reservations:cancel)
      const res2 = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/cancellation')
        .set('Authorization', `Bearer ${studentLimitedToken}`)
        .send({ reason: 'Bypass test' });

      expect(res2.statusCode).toBe(403);
    });

    it('3. Foreign object returns 404 without leaking ownership info', async () => {
      // student-b attempts to read student-a\'s reservation rsv_9X8y7Z
      const res = await request(app)
        .get('/v1/reservations/rsv_9X8y7Z')
        .set('Authorization', `Bearer ${studentBToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.type).toBe('https://api.library.example/problems/not-found');
      expect(res.body.detail).toBe('Reservation not found.');
      // Must not leak owner identity
      expect(JSON.stringify(res.body)).not.toContain('student-a');
    });

    it('4. Request with no token returns 401 Unauthorized', async () => {
      const res = await request(app).get('/v1/rooms');

      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toContain('Bearer');
    });
  });

  // ---------------------------------------------------------------------------
  // E. CORS & HEADERS INTEGRATION
  // ---------------------------------------------------------------------------
  describe('E. CORS & Header Exposure', () => {
    it('exposes ETag header in CORS Access-Control-Expose-Headers', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.statusCode).toBe(200);
      const exposeHeaders = res.headers['access-control-expose-headers'] || '';
      expect(exposeHeaders).toContain('ETag');
    });
  });
});
