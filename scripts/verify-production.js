/**
 * End-to-End Production Verification Script
 * Validates:
 * 1. Health endpoint
 * 2. Preflight CORS
 * 3. A.7 Conditional GET (200 -> ETag -> 304 Not Modified)
 * 4. A.8 Conditional Write (Stale If-Match -> 412 Precondition Failed)
 * 5. A.9 Live Authorization Attacks (403 Scope denial, 404 Object denial, 401 Unauthenticated)
 */

const { mintToken } = require('../service/src/auth/tokens');

const BACKEND_URL = process.env.API_URL || 'https://study-reservation-pbse-feature-data-five.vercel.app';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://study-reservation-pbse-frontend.vercel.app';

async function run() {
  console.log('====================================================');
  console.log('STUDY ROOM RESERVATION SYSTEM — PRODUCTION VERIFICATION');
  console.log(`Backend Target:  ${BACKEND_URL}`);
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health Check
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'pass', '1. /health returns 200 Pass');
  } catch (err) {
    assert(false, `1. /health failed: ${err.message}`);
  }

  // 2. CORS Preflight
  try {
    const res = await fetch(`${BACKEND_URL}/v1/rooms`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,If-None-Match'
      }
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const exposeHeaders = res.headers.get('access-control-expose-headers') || '';
    assert(
      res.status === 204 &&
      allowOrigin === FRONTEND_ORIGIN &&
      exposeHeaders.includes('ETag'),
      '2. Production CORS preflight accepts frontend origin and exposes ETag'
    );
  } catch (err) {
    assert(false, `2. CORS preflight failed: ${err.message}`);
  }

  // 3. A.7 Conditional GET: First Read (200 + ETag)
  let initialEtag = null;
  const studentAToken = mintToken({
    subject: 'student-a',
    scopes: ['rooms:read', 'reservations:read', 'reservations:cancel', 'reservations:checkin', 'reservations:create']
  });

  try {
    const res = await fetch(`${BACKEND_URL}/v1/rooms`, {
      headers: { Authorization: `Bearer ${studentAToken}` }
    });
    initialEtag = res.headers.get('etag');
    const data = await res.json();
    const count = data.items ? data.items.length : data.length;
    assert(
      res.status === 200 && initialEtag && count > 0,
      `3. A.7 First GET /v1/rooms returns 200 with ETag: ${initialEtag}`
    );
  } catch (err) {
    assert(false, `3. A.7 First GET failed: ${err.message}`);
  }

  // 4. A.7 Conditional GET: Subsequent Read (304 Not Modified, empty body)
  try {
    const res = await fetch(`${BACKEND_URL}/v1/rooms`, {
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'If-None-Match': initialEtag
      }
    });
    const body = await res.text();
    assert(
      res.status === 304 && body.length === 0,
      '4. A.7 Second GET with If-None-Match returns 304 Not Modified with empty body'
    );
  } catch (err) {
    assert(false, `4. A.7 Conditional GET failed: ${err.message}`);
  }

  // 5. A.8 Conditional Write: Stale If-Match returns 412 Precondition Failed
  try {
    const res = await fetch(`${BACKEND_URL}/v1/reservations/rsv_9X8y7Z/cancellation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
        'If-Match': '"stale-reservation-version-1"'
      },
      body: JSON.stringify({ reason: 'Scheduling conflict' })
    });
    const problem = await res.json();
    assert(
      res.status === 412 &&
      problem.type === 'https://api.library.example/problems/precondition-failed',
      `5. A.8 POST cancellation with stale If-Match returns 412 Precondition Failed (${problem.title})`
    );
  } catch (err) {
    assert(false, `5. A.8 Conditional write failed: ${err.message}`);
  }

  // 6. A.9 Authorization Attack: Scenario 1 — Wrong Scope / Role (403 Forbidden)
  const studentLimitedToken = mintToken({
    subject: 'student-limited',
    scopes: ['rooms:read']
  });

  try {
    const res = await fetch(`${BACKEND_URL}/v1/reservations`, {
      headers: { Authorization: `Bearer ${studentLimitedToken}` }
    });
    const problem = await res.json();
    assert(
      res.status === 403 &&
      problem.type === 'https://api.library.example/problems/forbidden',
      `6. A.9 Console Attack 1: Student with missing scope receives 403 Forbidden (Never 200)`
    );
  } catch (err) {
    assert(false, `6. A.9 Scenario 1 failed: ${err.message}`);
  }

  // 7. A.9 Authorization Attack: Scenario 2 — Object Authorization / Foreign Object (404 Not Found)
  const studentBToken = mintToken({
    subject: 'student-b',
    scopes: ['rooms:read', 'reservations:read']
  });

  try {
    const res = await fetch(`${BACKEND_URL}/v1/reservations/rsv_9X8y7Z`, {
      headers: { Authorization: `Bearer ${studentBToken}` }
    });
    const problem = await res.json();
    assert(
      res.status === 404 &&
      problem.type === 'https://api.library.example/problems/not-found' &&
      !JSON.stringify(problem).toLowerCase().includes('student-a'),
      `7. A.9 Console Attack 2: Student B accessing Student A reservation receives 404 (ownership NOT leaked)`
    );
  } catch (err) {
    assert(false, `7. A.9 Scenario 2 failed: ${err.message}`);
  }

  // 8. A.9 Authorization Attack: Scenario 3 — Unauthenticated Access (401 Unauthorized)
  try {
    const res = await fetch(`${BACKEND_URL}/v1/reservations/rsv_9X8y7Z`);
    const problem = await res.json();
    assert(
      res.status === 401 &&
      problem.type === 'https://api.library.example/problems/unauthorized',
      `8. A.9 Console Attack 3: Unauthenticated access returns 401 Unauthorized`
    );
  } catch (err) {
    assert(false, `8. A.9 Scenario 3 failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
