/**
 * ============================================================================
 * SECURITY TESTS — Layer 1 (Auth), Layer 2 (Scope), Layer 3 (Object), Logging
 * Step 7–9 Security Verification
 * ============================================================================
 */

const crypto = require('crypto');
const request = require('supertest');

const app = require('../../service/src/app');
const { mintToken } = require('../../service/src/auth/tokens');
const {
  getRecentSecurityEvents,
  clearSecurityEvents
} = require('../../service/src/security/audit-logger');

describe('Security Layer 1, 2, 3 & Logging Verification (Step 7–9)', () => {
  let studentAToken;
  let studentBToken;
  let studentLimitedToken;
  let adminToken;

  beforeAll(async () => {
    studentAToken = await mintToken({
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

    studentBToken = await mintToken({
      subject: 'student-b',
      scopes: [
        'rooms:read',
        'reservations:read',
        'reservations:create',
        'reservations:cancel',
        'reservations:write'
      ]
    });

    studentLimitedToken = await mintToken({
      subject: 'student-limited',
      scopes: ['rooms:read']
    });

    adminToken = await mintToken({
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
    clearSecurityEvents();
  });

  // ---------------------------------------------------------------------------
  // 1. LAYER 1: AUTHENTICATION
  // ---------------------------------------------------------------------------

  describe('Layer 1 — Authentication (401 Unauthorized)', () => {
    it('returns 401 when Authorization header is completely absent on protected endpoint', async () => {
      const res = await request(app).get('/v1/rooms');

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toMatch(
        /application\/problem\+json/
      );
      expect(res.headers['www-authenticate']).toMatch(
        /Bearer error="invalid_token"/
      );

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 401,
          type: 'https://api.library.example/problems/unauthorized',
          title: 'Authentication is required'
        })
      );
    });

    it('returns 401 when Authorization scheme is not Bearer', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toMatch(
        /application\/problem\+json/
      );
      expect(res.body.status).toBe(401);
    });

    it('returns 401 when Bearer token is malformed or invalid signature', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toMatch(
        /application\/problem\+json/
      );
      expect(res.body.status).toBe(401);
    });

    it('allows access to public health endpoints without a token', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('pass');
    });

    it('authenticates successfully with valid Bearer token', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. LAYER 2: SCOPE CHECKING
  // ---------------------------------------------------------------------------

  describe('Layer 2 — Scope Checking (403 Forbidden)', () => {
    it('rejects with 403 when principal lacks the required scope (reservations:create)', async () => {
      const res = await request(app)
        .post('/v1/reservations')
        .set('Authorization', `Bearer ${studentLimitedToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          roomId: 'rm_1a2B3cD',
          date: '2027-01-15',
          startTime: '13:00',
          endTime: '15:00'
        });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toMatch(
        /application\/problem\+json/
      );
      expect(res.headers['www-authenticate']).toMatch(
        /Bearer error="insufficient_scope"/
      );

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 403,
          type: 'https://api.library.example/problems/forbidden',
          title: 'Insufficient permissions'
        })
      );
    });

    it('allows request when principal possesses the required scope', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentLimitedToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. LAYER 3: OBJECT CHECKING
  // ---------------------------------------------------------------------------

  describe('Layer 3 — Object Checking (Ownership Enforcement)', () => {
    it('rejects non-owner with generic 404 without leaking owner identity (Student A -> rsv_Aa1Bb2)', async () => {
      const res = await request(app)
        .get('/v1/reservations/rsv_Aa1Bb2')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(
        /application\/problem\+json/
      );

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 404,
          type: 'https://api.library.example/problems/not-found',
          title: 'Not Found',
          detail: 'Reservation not found.'
        })
      );

      // Verify no sensitive identity leakage
      expect(JSON.stringify(res.body)).not.toContain('student-b');
    });

    it('rejects cancellation attempt on another student reservation (Student A -> rsv_Aa1Bb2)', async () => {
      const res = await request(app)
        .post('/v1/reservations/rsv_Aa1Bb2/cancellation')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ reason: 'Malicious cancellation attempt' });

      expect(res.statusCode).toBe(404);
      expect(res.body.detail).toBe('Reservation not found.');
    });

    it('rejects check-in on another student reservation (Student A -> rsv_Aa1Bb2)', async () => {
      const res = await request(app)
        .post('/v1/reservations/rsv_Aa1Bb2/checkin')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.detail).toBe('Reservation not found.');
    });

    it('rejects check-in when user lacks reservations:checkin scope', async () => {
      const res = await request(app)
        .post('/v1/reservations/rsv_9X8y7Z/checkin')
        .set('Authorization', `Bearer ${studentLimitedToken}`);

      // Scope denial must remain 403, not object-level 404
      expect(res.statusCode).toBe(403);
      expect(res.headers['www-authenticate']).toMatch(
        /Bearer error="insufficient_scope"/
      );
    });

    it('allows admin principal to access objects across all users', async () => {
      const res = await request(app)
        .get('/v1/reservations/rsv_Aa1Bb2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('rsv_Aa1Bb2');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. REQUEST CORRELATION ID & LOGGING SECURITY
  // ---------------------------------------------------------------------------

  describe('Request IDs & Security Audit Logging', () => {
    it('echoes provided X-Request-ID in response headers', async () => {
      const clientReqId = 'client-trace-id-12345';

      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('X-Request-ID', clientReqId);

      expect(res.headers['x-request-id']).toBe(clientReqId);
    });

    it('generates server-side UUID when X-Request-ID is absent or malformed', async () => {
      const res = await request(app)
        .get('/v1/rooms')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThanOrEqual(16);
    });

    it('records security events on authentication failure with correlation ID', async () => {
      const traceId = 'sec-test-trace-999';

      await request(app)
        .get('/v1/rooms')
        .set('X-Request-ID', traceId);

      const events = getRecentSecurityEvents();
      const authEvent = events.find((e) => e.requestId === traceId);

      expect(authEvent).toBeDefined();
      expect(authEvent.event).toBe('authentication.required');
      expect(authEvent.result).toBe('denied');
    });

    it('records security event on Layer 3 object denial without logging secrets', async () => {
      const traceId = 'object-denial-trace-001';

      await request(app)
        .get('/v1/reservations/rsv_Aa1Bb2')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('X-Request-ID', traceId);

      const events = getRecentSecurityEvents();
      const objectEvent = events.find((e) => e.requestId === traceId);

      expect(objectEvent).toBeDefined();
      expect(objectEvent.event).toBe('authorization.object_denied');
      expect(objectEvent.actorId).toBe('student-a');
      expect(objectEvent.resourceId).toBe('rsv_Aa1Bb2');
      expect(objectEvent.result).toBe('denied');

      // Verify no secrets or raw tokens logged
      const serialized = JSON.stringify(objectEvent);
      expect(serialized).not.toContain(studentAToken);
    });
  });
});