/**
 * ============================================================================
 * RFC 9457 PROBLEM DETAILS HELPER
 * Owned by: PERSON 4 (Cross-Cutting Errors + Idempotency + CI)
 * ============================================================================
 * Responsibilities (Pages 6-7 & Assignment Section A.6):
 * - Create one standardized error function producing the API's failure shape.
 * - Produces responses with Content-Type: application/problem+json.
 * - Standard RFC 9457 fields:
 *   - status: HTTP status code integer
 *   - type: Stable URI identifying the error kind (never changes)
 *   - title: Fixed human-readable summary for developers
 *   - detail: Explanation specific to this occurrence
 *   - instance: Request path / URI of this occurrence
 * - Allows extension members (e.g. invalidParams, fields, from, to, allowedFrom)
 * - Strips sensitive internal error details (stack traces, SQL fragments) on 500
 * ============================================================================
 */

const PROBLEM_TYPES = {
  BAD_REQUEST: 'https://api.library.example/problems/malformed-request',
  NOT_FOUND: 'https://api.library.example/problems/not-found',
  CONFLICT: 'https://api.library.example/problems/conflict',
  IDEMPOTENCY_KEY_REUSE: 'https://api.library.example/problems/idempotency-key-reuse',
  ILLEGAL_TRANSITION: 'https://api.library.example/problems/illegal-transition',
  ROOM_UNAVAILABLE: 'https://api.library.example/problems/room-unavailable',
  VALIDATION_FAILED: 'https://api.library.example/problems/validation-failed',
  INTERNAL_SERVER_ERROR: 'https://api.library.example/problems/internal-server-error'
};

const DEFAULT_TITLES = {
  [PROBLEM_TYPES.BAD_REQUEST]: 'The request could not be parsed',
  [PROBLEM_TYPES.NOT_FOUND]: 'Resource not found',
  [PROBLEM_TYPES.CONFLICT]: 'A domain conflict occurred',
  [PROBLEM_TYPES.IDEMPOTENCY_KEY_REUSE]: 'Idempotency-Key has already been used with a different request body',
  [PROBLEM_TYPES.ILLEGAL_TRANSITION]: 'That status change is not permitted',
  [PROBLEM_TYPES.ROOM_UNAVAILABLE]: 'The room is already reserved for the requested time',
  [PROBLEM_TYPES.VALIDATION_FAILED]: 'One or more fields are invalid',
  [PROBLEM_TYPES.INTERNAL_SERVER_ERROR]: 'Internal Server Error'
};

/**
 * Builds an RFC 9457 Problem Details object.
 *
 * @param {Object} params
 * @param {number} [params.status=500] - HTTP status code
 * @param {string} [params.type] - Stable URI identifying the error kind
 * @param {string} [params.title] - Fixed developer-facing summary
 * @param {string} [params.detail] - Occurrence-specific explanation
 * @param {string} [params.instance] - URI of the occurrence (e.g., req.originalUrl)
 * @param {Object} [params.extensions] - Additional RFC 9457 extension members
 * @returns {Object} Canonical Problem Details JSON object
 */
function problem({
  status = 500,
  type,
  title,
  detail,
  instance,
  ...extensions
} = {}) {
  // Infer type and title if omitted
  const resolvedType =
    type ||
    (status === 400
      ? PROBLEM_TYPES.BAD_REQUEST
      : status === 404
      ? PROBLEM_TYPES.NOT_FOUND
      : status === 409
      ? PROBLEM_TYPES.CONFLICT
      : status === 422
      ? PROBLEM_TYPES.VALIDATION_FAILED
      : PROBLEM_TYPES.INTERNAL_SERVER_ERROR);

  const resolvedTitle =
    title ||
    DEFAULT_TITLES[resolvedType] ||
    (status >= 500 ? 'Internal Server Error' : 'Client Error');

  const problemObj = {
    type: resolvedType,
    title: resolvedTitle,
    status
  };

  if (detail !== undefined && detail !== null) {
    problemObj.detail = String(detail);
  }

  if (instance !== undefined && instance !== null) {
    problemObj.instance = String(instance);
  }

  // Merge any RFC 9457 extension members
  for (const [key, value] of Object.entries(extensions)) {
    if (value !== undefined) {
      problemObj[key] = value;
    }
  }

  return problemObj;
}

/**
 * Sends an RFC 9457 Problem Details response with Content-Type: application/problem+json.
 *
 * @param {import('express').Response} res
 * @param {Object} details - Problem Details properties
 */
function sendProblem(res, details) {
  const body = problem(details);
  return res
    .status(body.status)
    .type('application/problem+json')
    .json(body);
}

/**
 * Express middleware for 404 Not Found handling using RFC 9457.
 */
function notFoundHandler(req, res) {
  return sendProblem(res, {
    status: 404,
    type: PROBLEM_TYPES.NOT_FOUND,
    title: 'Resource not found',
    detail: `Route ${req.method} ${req.originalUrl || req.path} does not exist.`,
    instance: req.originalUrl || req.path
  });
}

/**
 * Express global error handling middleware using RFC 9457.
 */
function problemHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : 500;

  const instance = req.originalUrl || req.path;

  // For 500 server errors, do not leak internal stack traces or database info
  if (status >= 500) {
    console.error('Unhandled internal server error:', err);
    return sendProblem(res, {
      status: 500,
      type: PROBLEM_TYPES.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      detail:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred.'
          : err.message || 'An unexpected error occurred.',
      instance
    });
  }

  // For 4xx domain / client errors
  const type =
    err.type ||
    (status === 400
      ? PROBLEM_TYPES.BAD_REQUEST
      : status === 404
      ? PROBLEM_TYPES.NOT_FOUND
      : status === 409
      ? (err.code === 'IDEMPOTENCY_KEY_REUSE'
          ? PROBLEM_TYPES.IDEMPOTENCY_KEY_REUSE
          : err.code === 'ILLEGAL_TRANSITION'
          ? PROBLEM_TYPES.ILLEGAL_TRANSITION
          : PROBLEM_TYPES.CONFLICT)
      : status === 422
      ? PROBLEM_TYPES.VALIDATION_FAILED
      : undefined);

  const title = err.title || DEFAULT_TITLES[type];
  const detail = err.detail || err.message;

  // Collect extension members (e.g. fields, invalidParams, from, to, allowedFrom)
  const extensions = {};
  if (err.fields) extensions.fields = err.fields;
  if (err.invalidParams) extensions.invalidParams = err.invalidParams;
  if (err.from) extensions.from = err.from;
  if (err.to) extensions.to = err.to;
  if (err.allowedFrom) extensions.allowedFrom = err.allowedFrom;
  if (err.conflictingReservationId) extensions.conflictingReservationId = err.conflictingReservationId;

  return sendProblem(res, {
    status,
    type,
    title,
    detail,
    instance,
    ...extensions
  });
}

module.exports = {
  problem,
  sendProblem,
  notFoundHandler,
  problemHandler,
  PROBLEM_TYPES,
  DEFAULT_TITLES
};
