const crypto = require('crypto');

/**
 * Computes an opaque, deterministic strong ETag for a collection of resources.
 *
 * @param {Array} items
 * @param {string} prefix
 * @returns {string} Quoted ETag
 */
function computeCollectionEtag(items, prefix = 'col') {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(items || []))
    .digest('hex')
    .slice(0, 16);
  return `"${prefix}-${hash}"`;
}

/**
 * Computes an opaque, deterministic strong ETag for a reservation entity.
 * Captures status changes, timestamps, and key fields to detect state transitions.
 *
 * @param {Object} reservation
 * @returns {string} Quoted ETag
 */
function computeReservationEtag(reservation) {
  if (!reservation) return '""';
  const key = [
    reservation.id,
    reservation.status,
    reservation.cancelled_at || reservation.cancelledAt || '',
    reservation.checked_in_at || reservation.checkedInAt || '',
    reservation.cancel_reason || reservation.cancelReason || '',
    reservation.room_id || reservation.roomId || '',
    reservation.date || '',
    reservation.start_time || reservation.startTime || '',
    reservation.end_time || reservation.endTime || ''
  ].join(':');

  const hash = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex')
    .slice(0, 16);

  return `"${reservation.id}-${hash}"`;
}

/**
 * Computes an opaque, deterministic strong ETag for any entity.
 *
 * @param {Object} entity
 * @param {string} prefix
 * @returns {string} Quoted ETag
 */
function computeEntityEtag(entity, prefix = 'ent') {
  if (!entity) return '""';
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(entity))
    .digest('hex')
    .slice(0, 16);
  return `"${prefix}-${entity.id || ''}-${hash}"`;
}

/**
 * Validates if an incoming If-Match or If-None-Match matches the current ETag.
 * Handles weak comparison (stripping W/ prefix) and wildcard (*).
 *
 * @param {string} headerValue
 * @param {string} currentEtag
 * @returns {boolean}
 */
function matchesEtag(headerValue, currentEtag) {
  if (!headerValue || !currentEtag) return false;
  const trimmed = headerValue.trim();
  if (trimmed === '*') return true;

  // Split comma-separated ETags if multiple values were passed
  const candidates = trimmed.split(',').map((s) => s.trim().replace(/^W\//, ''));
  const cleanCurrent = currentEtag.trim().replace(/^W\//, '');

  return candidates.includes(cleanCurrent);
}

module.exports = {
  computeCollectionEtag,
  computeReservationEtag,
  computeEntityEtag,
  matchesEtag
};
