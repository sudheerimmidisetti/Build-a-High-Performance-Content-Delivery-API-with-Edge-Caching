function buildOriginShieldMiddleware(config = {}) {
  const enabled = Boolean(config.enabled);
  const secret = config.secret || '';

  return function originShieldMiddleware(request, reply, done) {
    if (!enabled) {
      done();
      return;
    }

    const suppliedSecret = request.headers['x-origin-secret'];
    if (suppliedSecret !== secret) {
      reply.code(403).send({
        message:
          'Direct origin access denied. Route is restricted to CDN traffic.',
      });
      return;
    }

    done();
  };
}

module.exports = {
  buildOriginShieldMiddleware,
};
