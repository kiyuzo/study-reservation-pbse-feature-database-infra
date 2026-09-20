const { forbidden, unauthorized } = require('../problem');

function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.principal) {
      return unauthorized(res);
    }

    if (!req.principal.scopes.includes(requiredScope)) {
      return forbidden(res, requiredScope);
    }

    return next();
  };
}

module.exports = {
  requireScope
};