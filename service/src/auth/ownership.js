const { sendProblem, PROBLEM_TYPES } = require('../problem');
const { logSecurityEvent } = require('../security/audit-logger');

function isOwner(principal, ownerSubject) {
  return Boolean(
    principal &&
    principal.subject &&
    principal.subject === ownerSubject
  );
}

function canAccessObject(principal, object) {
  if (!principal || !object) {
    return false;
  }

  // Confidential background jobs (e.g., cleanup-job) have access to clean up abandoned reservations
  if (principal.kind === 'job') {
    return true;
  }

  // Admin users have full oversight
  if (Array.isArray(principal.scopes) && principal.scopes.includes('admin:manage')) {
    return true;
  }

  const ownerSubject =
    object.userId ||
    object.user_id ||
    object.ownerSubject;

  return isOwner(principal, ownerSubject);
}

/**
 * Sends a generic RFC 9457 403 Forbidden response for object authorization failures.
 * Never leaks resource owner identity or internal details.
 */
function sendObjectAccessDenied(res, req, reservationId) {
  logSecurityEvent({
    event: 'authorization.object_denied',
    actorId: req.principal ? req.principal.subject : 'anonymous',
    method: req.method,
    path: req.originalUrl || req.path,
    resourceId: reservationId,
    result: 'denied',
    reason: 'ownership_mismatch',
    requestId: req.id,
    metadata: {
      action: req.method
    }
  });

  return sendProblem(res, {
  status: 404,
  type: 'https://api.library.example/problems/not-found',
  title: 'Not Found',
  detail: 'Reservation not found.',
  instance: req.originalUrl || req.path
});
}

module.exports = {
  isOwner,
  canAccessObject,
  sendObjectAccessDenied
};
