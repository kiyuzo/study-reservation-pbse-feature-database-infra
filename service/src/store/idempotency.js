/**
 * ============================================================================
 * IDEMPOTENCY STORE & HANDLER
 * Owned by: PERSON 4 (Cross-Cutting Errors + Idempotency + CI)
 * ============================================================================
 * Responsibilities (Pages 7-8 & 11, Assignment Section A.8):
 * - Must be stored in the database, NOT in memory.
 * - Survives service/process restart.
 * - Expose functions for Person 3:
 *   - checkIdempotencyKey(key, body)
 *   - saveIdempotencyResult(key, body, statusCode, responseData)
 *   - findIdempotencyKey(key)
 *   - saveIdempotencyKey(...)
 *   - hashRequestBody(body)
 *
 * Exact decision order mandated by assignment:
 * Idempotency-Key
 *   ↓
 * check database
 *   ↓
 * 1. never seen:
 *    → proceed with request
 *    → save key + body hash + response
 * 2. already seen + same body:
 *    → return saved 201 response directly
 * 3. already seen + different body:
 *    → 409 Conflict (https://api.library.example/problems/idempotency-key-reuse)
 * ============================================================================
 */

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

/**
 * Returns a configured Database instance.
 */
function getDatabase() {
  const configuredPath = process.env.DATABASE_PATH || './db/reservation.sqlite';
  const dbPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(__dirname, '..', '..', configuredPath);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Generates a deterministic SHA-256 hash of the request body.
 *
 * @param {any} body - Request body object or string
 * @returns {string} SHA-256 hexadecimal digest
 */
function hashRequestBody(body) {
  if (body === undefined || body === null) {
    return crypto.createHash('sha256').update('').digest('hex');
  }

  // Canonicalize object keys if body is an object
  let serialized;
  if (typeof body === 'object') {
    serialized = JSON.stringify(body, Object.keys(body).sort());
  } else {
    serialized = String(body);
  }

  return crypto
    .createHash('sha256')
    .update(serialized)
    .digest('hex');
}

/**
 * Retrieves an idempotency key record from the database.
 *
 * @param {string} key - The Idempotency-Key UUID
 * @returns {Object|undefined} Stored idempotency record or undefined
 */
function findIdempotencyKey(key) {
  const db = getDatabase();
  try {
    return db
      .prepare(`
        SELECT
          key,
          request_hash,
          response_status,
          response_body,
          created_at,
          expires_at
        FROM idempotency_keys
        WHERE key = ?
      `)
      .get(key);
  } finally {
    db.close();
  }
}

/**
 * Saves an idempotency key record directly to SQLite.
 *
 * @param {Object} record
 * @param {string} record.key - Idempotency Key UUID
 * @param {string} record.requestHash - SHA-256 hash of the request payload
 * @param {number} record.responseStatus - HTTP status code (typically 201)
 * @param {string} record.responseBody - Serialized JSON response string
 * @param {string} record.createdAt - ISO timestamp
 * @param {string} record.expiresAt - ISO timestamp (retained for 24h)
 */
function saveIdempotencyKey({
  key,
  requestHash,
  responseStatus,
  responseBody,
  createdAt,
  expiresAt
}) {
  const db = getDatabase();
  try {
    db
      .prepare(`
        INSERT INTO idempotency_keys (
          key,
          request_hash,
          response_status,
          response_body,
          created_at,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          request_hash = excluded.request_hash,
          response_status = excluded.response_status,
          response_body = excluded.response_body,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at
      `)
      .run(
        key,
        requestHash,
        responseStatus,
        responseBody,
        createdAt,
        expiresAt
      );
  } finally {
    db.close();
  }
}

/**
 * Verifies an Idempotency-Key against the database following the exact decision order:
 * 1. Never seen -> returns { seen: false, requestHash }
 * 2. Already seen + same body -> returns { seen: true, match: true, statusCode, response }
 * 3. Already seen + different body -> returns { seen: true, match: false, conflict: true }
 *
 * @param {string} key - Idempotency-Key header value
 * @param {any} body - Request body
 * @returns {{ seen: boolean, match?: boolean, conflict?: boolean, statusCode?: number, response?: any, requestHash: string }}
 */
function checkIdempotencyKey(key, body) {
  const requestHash = hashRequestBody(body);
  const existing = findIdempotencyKey(key);

  if (!existing) {
    return {
      seen: false,
      requestHash
    };
  }

  // Already seen: check if request body matches
  if (existing.request_hash !== requestHash) {
    return {
      seen: true,
      match: false,
      conflict: true,
      requestHash,
      message: 'Idempotency-Key has already been used with a different request body.'
    };
  }

  // Already seen + identical body -> replay original response
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(existing.response_body);
  } catch {
    parsedResponse = existing.response_body;
  }

  return {
    seen: true,
    match: true,
    conflict: false,
    statusCode: existing.response_status,
    response: parsedResponse,
    requestHash
  };
}

/**
 * Saves a completed response into the database for future idempotent replays.
 *
 * @param {string} key - Idempotency-Key
 * @param {any} body - Request body
 * @param {number} statusCode - HTTP status code (201)
 * @param {any} responseData - Response payload
 * @param {number} [ttlHours=24] - Retention period in hours (24h per OpenAPI contract)
 */
function saveIdempotencyResult(key, body, statusCode, responseData, ttlHours = 24) {
  const requestHash = hashRequestBody(body);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const responseBody =
    typeof responseData === 'string'
      ? responseData
      : JSON.stringify(responseData);

  saveIdempotencyKey({
    key,
    requestHash,
    responseStatus: statusCode,
    responseBody,
    createdAt,
    expiresAt
  });

  return {
    key,
    requestHash,
    responseStatus: statusCode,
    createdAt,
    expiresAt
  };
}

module.exports = {
  getDatabase,
  hashRequestBody,
  findIdempotencyKey,
  saveIdempotencyKey,
  checkIdempotencyKey,
  saveIdempotencyResult
};
