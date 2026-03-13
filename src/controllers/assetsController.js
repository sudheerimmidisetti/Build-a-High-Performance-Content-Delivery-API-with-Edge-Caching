const {
  applyCachingHeaders,
  resolveCacheControl,
} = require('../../config/cache');
const { matchesIfNoneMatch } = require('../utils/etag');
const { httpError } = require('../services/assetService');

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

async function parseMultipartFile(request) {
  const part = await request.file();
  if (!part) {
    throw httpError(
      400,
      'File is required. Use multipart/form-data with a file field.',
    );
  }

  const buffer = await part.toBuffer();
  return {
    buffer,
    filename: part.filename || 'asset.bin',
    mimeType: part.mimetype || 'application/octet-stream',
    fields: part.fields || {},
  };
}

function sendCacheHeaders(reply, options) {
  applyCachingHeaders(reply, {
    etag: options.etag,
    lastModified: options.lastModified,
    cacheControl: options.cacheControl,
    contentType: options.contentType,
    contentLength: options.contentLength,
  });
}

function createAssetsController(fastify) {
  const service = fastify.services.assetService;

  return {
    uploadAsset: async (request, reply) => {
      const parsed = await parseMultipartFile(request);
      const isPrivateField =
        parsed.fields?.is_private?.value || parsed.fields?.isPrivate?.value;
      const isPrivate = parseBoolean(isPrivateField);

      const asset = await service.uploadAsset(
        {
          buffer: parsed.buffer,
          filename: parsed.filename,
          mimeType: parsed.mimeType,
        },
        { isPrivate },
      );

      reply.code(201).send({
        id: asset.id,
        etag: asset.etag,
        filename: asset.filename,
        size: Number(asset.size_bytes),
        mime_type: asset.mime_type,
        is_private: asset.is_private,
        current_version_id: asset.current_version_id,
      });
    },

    downloadAsset: async (request, reply) => {
      const asset = await service.getAssetMetadata(request.params.id);
      const ifNoneMatch = request.headers['if-none-match'];
      const cacheControl = resolveCacheControl({
        isPrivate: asset.is_private,
        immutable: false,
      });

      sendCacheHeaders(reply, {
        etag: asset.etag,
        lastModified: asset.updated_at,
        cacheControl,
        contentType: asset.mime_type,
        contentLength: Number(asset.size_bytes),
      });

      if (matchesIfNoneMatch(ifNoneMatch, asset.etag)) {
        reply.code(304).send();
        return;
      }

      const object = await service.getAssetObjectBuffer(
        asset.object_storage_key,
      );
      reply.code(200).send(object.buffer);
    },

    headAsset: async (request, reply) => {
      const asset = await service.getAssetMetadata(request.params.id);
      const ifNoneMatch = request.headers['if-none-match'];
      const cacheControl = resolveCacheControl({
        isPrivate: asset.is_private,
        immutable: false,
      });

      sendCacheHeaders(reply, {
        etag: asset.etag,
        lastModified: asset.updated_at,
        cacheControl,
        contentType: asset.mime_type,
        contentLength: Number(asset.size_bytes),
      });

      if (matchesIfNoneMatch(ifNoneMatch, asset.etag)) {
        reply.code(304).send();
        return;
      }

      reply.code(200).send();
    },

    publishAsset: async (request, reply) => {
      const payload = {};

      if (typeof request.isMultipart === 'function' && request.isMultipart()) {
        const parsed = await parseMultipartFile(request);
        payload.file = {
          buffer: parsed.buffer,
          filename: parsed.filename,
          mimeType: parsed.mimeType,
        };
      } else {
        payload.newContentKey = request.body?.new_content_key;
        payload.filename = request.body?.filename;
      }

      const result = await service.publishAssetVersion(
        request.params.id,
        payload,
      );

      reply.code(200).send({
        id: result.asset.id,
        current_version_id: result.asset.current_version_id,
        etag: result.asset.etag,
        version_id: result.versionId,
        purge: result.purgeResult,
      });
    },

    getPublicAsset: async (request, reply) => {
      const version = await service.getVersionMetadata(
        request.params.version_id,
      );
      const ifNoneMatch = request.headers['if-none-match'];
      const cacheControl = resolveCacheControl({ immutable: true });

      if (matchesIfNoneMatch(ifNoneMatch, version.etag)) {
        reply.header('ETag', version.etag);
        reply.header('Cache-Control', cacheControl);
        reply.header(
          'Last-Modified',
          new Date(version.created_at).toUTCString(),
        );
        reply.code(304).send();
        return;
      }

      const object = await service.getAssetObjectBuffer(
        version.object_storage_key,
      );
      sendCacheHeaders(reply, {
        etag: version.etag,
        lastModified: version.created_at,
        cacheControl,
        contentType: version.mime_type,
        contentLength: object.contentLength,
      });
      reply.code(200).send(object.buffer);
    },

    getPrivateAsset: async (request, reply) => {
      const { access, object, cacheControl } =
        await service.getPrivateAssetByToken(request.params.token);

      sendCacheHeaders(reply, {
        etag: access.etag,
        lastModified: access.updated_at,
        cacheControl,
        contentType: access.mime_type,
        contentLength: Number(access.size_bytes),
      });

      reply.code(200).send(object.buffer);
    },

    createAccessToken: async (request, reply) => {
      const token = await service.createPrivateAccessToken(
        request.params.id,
        request.body?.ttl_seconds,
      );

      reply.code(201).send({
        token: token.token,
        expires_at: token.expires_at,
        asset_id: token.asset_id,
      });
    },

    purgeAsset: async (request, reply) => {
      const result = await service.purgeMutableAsset(request.params.id);
      reply.code(200).send({ purged: result });
    },
  };
}

module.exports = {
  createAssetsController,
};
