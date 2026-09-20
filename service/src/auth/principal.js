function buildPrincipal(payload) {
  const scopes = typeof payload.scope === 'string'
    ? payload.scope.split(' ').filter(Boolean)
    : [];

  const kind = payload.client_id === 'cleanup-job'
    ? 'job'
    : 'user';

  return {
    subject: payload.sub,
    kind,
    scopes,
    tokenId: payload.jti
  };
}

module.exports = {
  buildPrincipal
};