const CACHE_CONTROL = {
  IMMUTABLE_PUBLIC: 'public, max-age=31536000, immutable',
  MUTABLE_PUBLIC: 'public, s-maxage=3600, max-age=60',
  PRIVATE: 'private, no-store, no-cache, must-revalidate',
};

function resolveCacheControl({ isPrivate = false, immutable = false }) {
  if (isPrivate) {
    return CACHE_CONTROL.PRIVATE;
  }

  if (immutable) {
    return CACHE_CONTROL.IMMUTABLE_PUBLIC;
  }

  return CACHE_CONTROL.MUTABLE_PUBLIC;
}

function applyCachingHeaders(reply, payload) {
  reply.header('ETag', payload.etag);
  reply.header('Last-Modified', new Date(payload.lastModified).toUTCString());
  reply.header('Cache-Control', payload.cacheControl);
  reply.header('Content-Type', payload.contentType);
  reply.header('Content-Length', String(payload.contentLength));
}

module.exports = {
  CACHE_CONTROL,
  resolveCacheControl,
  applyCachingHeaders,
};
