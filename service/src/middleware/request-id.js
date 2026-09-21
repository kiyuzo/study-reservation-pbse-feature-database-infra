const crypto = require('crypto');

const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

function requestIdMiddleware(req, res, next) {
  const incoming = req.get('X-Request-ID');
  const valid = incoming && REQUEST_ID_REGEX.test(incoming);
  const requestId = valid ? incoming : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;

  res.setHeader('X-Request-ID', requestId);

  return next();
}

module.exports = {
  requestIdMiddleware,
  REQUEST_ID_REGEX
};
