const crypto = require('crypto');

const { resolveCacheControl } = require('../../config/cache');
const {
  createAsset,
  getAssetById,
  setCurrentVersion,
  updateAssetContent,
} = require('../models/assetModel');
const {
  createAssetVersion,
  getAssetVersionById,
} = require('../models/assetVersionModel');
const {
  createAccessToken,
  getAccessTokenWithAsset,
} = require('../models/accessTokenModel');
const { sha256, toStrongEtag } = require('../utils/hash');
const { createSecureToken } = require('../utils/token');

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeFilename(filename) {
  return String(filename || 'asset.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildCurrentObjectKey(assetId, filename) {
  return `assets/${assetId}/current/${Date.now()}-${sanitizeFilename(filename)}`;
}

function buildVersionObjectKey(assetId, versionId, filename) {
  return `assets/${assetId}/versions/${versionId}/${sanitizeFilename(filename)}`;
}

class AssetService {
  constructor(options) {
    this.db = options.db;
    this.storage = options.storage;
    this.cdnPurgeService = options.cdnPurgeService;
    this.tokenTtlSeconds = Number(options.tokenTtlSeconds || 300);
  }

  async uploadAsset(file, options = {}) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw httpError(400, 'Uploaded file is empty.');
    }

    const assetId = crypto.randomUUID();
    const initialVersionId = crypto.randomUUID();
    const hash = sha256(file.buffer);
    const etag = toStrongEtag(hash);

    const currentObjectKey = buildCurrentObjectKey(assetId, file.filename);
    const versionObjectKey = buildVersionObjectKey(
      assetId,
      initialVersionId,
      file.filename,
    );

    await this.storage.putObject({
      key: currentObjectKey,
      body: file.buffer,
      contentType: file.mimeType,
    });

    await this.storage.putObject({
      key: versionObjectKey,
      body: file.buffer,
      contentType: file.mimeType,
    });

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      await createAsset(client, {
        id: assetId,
        objectStorageKey: currentObjectKey,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        etag,
        currentVersionId: null,
        isPrivate: Boolean(options.isPrivate),
      });

      await createAssetVersion(client, {
        id: initialVersionId,
        assetId,
        objectStorageKey: versionObjectKey,
        etag,
      });

      const updatedAsset = await setCurrentVersion(client, {
        id: assetId,
        currentVersionId: initialVersionId,
      });

      await client.query('COMMIT');

      return {
        ...updatedAsset,
        initial_version_id: initialVersionId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAssetMetadata(assetId) {
    const asset = await getAssetById(this.db, assetId);
    if (!asset) {
      throw httpError(404, 'Asset not found.');
    }

    return asset;
  }

  async getAssetObjectBuffer(objectStorageKey) {
    return this.storage.getObjectBuffer(objectStorageKey);
  }

  async getVersionMetadata(versionId) {
    const version = await getAssetVersionById(this.db, versionId);
    if (!version) {
      throw httpError(404, 'Asset version not found.');
    }

    return version;
  }

  async getMutableAsset(assetId) {
    const asset = await this.getAssetMetadata(assetId);
    const object = await this.storage.getObjectBuffer(asset.object_storage_key);

    return {
      asset,
      object,
      cacheControl: resolveCacheControl({
        isPrivate: asset.is_private,
        immutable: false,
      }),
    };
  }

  async publishAssetVersion(assetId, payload = {}) {
    const existingAsset = await this.getAssetMetadata(assetId);

    let sourceObjectKey = existingAsset.object_storage_key;
    let sourceFilename = existingAsset.filename;
    let sourceMimeType = existingAsset.mime_type;
    let sourceSize = Number(existingAsset.size_bytes);
    let sourceEtag = existingAsset.etag;

    if (payload.file?.buffer?.length) {
      sourceFilename = payload.file.filename;
      sourceMimeType = payload.file.mimeType;
      sourceSize = payload.file.buffer.length;
      sourceEtag = toStrongEtag(sha256(payload.file.buffer));
      sourceObjectKey = buildCurrentObjectKey(assetId, payload.file.filename);

      await this.storage.putObject({
        key: sourceObjectKey,
        body: payload.file.buffer,
        contentType: sourceMimeType,
      });
    }

    if (payload.newContentKey) {
      const object = await this.storage.getObjectBuffer(payload.newContentKey);

      sourceObjectKey = payload.newContentKey;
      sourceFilename = payload.filename || sourceFilename;
      sourceMimeType = object.contentType || sourceMimeType;
      sourceSize = Number(
        object.contentLength || sourceSize || object.buffer.length,
      );
      sourceEtag = toStrongEtag(sha256(object.buffer));
    }

    const versionId = crypto.randomUUID();
    const versionObjectKey = buildVersionObjectKey(
      assetId,
      versionId,
      sourceFilename,
    );

    await this.storage.copyObject(
      sourceObjectKey,
      versionObjectKey,
      sourceMimeType,
    );

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      if (payload.file?.buffer?.length || payload.newContentKey) {
        await updateAssetContent(client, {
          id: assetId,
          objectStorageKey: sourceObjectKey,
          filename: sourceFilename,
          mimeType: sourceMimeType,
          sizeBytes: sourceSize,
          etag: sourceEtag,
        });
      }

      await createAssetVersion(client, {
        id: versionId,
        assetId,
        objectStorageKey: versionObjectKey,
        etag: sourceEtag,
      });

      const updatedAsset = await setCurrentVersion(client, {
        id: assetId,
        currentVersionId: versionId,
      });

      await client.query('COMMIT');

      const purgeResult = await this.cdnPurgeService.purgePaths([
        `/assets/${assetId}/download`,
      ]);

      return {
        asset: updatedAsset,
        versionId,
        purgeResult,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPublicAssetVersion(versionId) {
    const version = await getAssetVersionById(this.db, versionId);
    if (!version) {
      throw httpError(404, 'Asset version not found.');
    }

    const object = await this.storage.getObjectBuffer(
      version.object_storage_key,
    );

    return {
      version,
      object,
      cacheControl: resolveCacheControl({ immutable: true }),
    };
  }

  async createPrivateAccessToken(assetId, ttlSeconds) {
    const asset = await this.getAssetMetadata(assetId);
    if (!asset.is_private) {
      throw httpError(
        400,
        'Access tokens can only be generated for private assets.',
      );
    }

    const token = createSecureToken(32);
    const expiresIn = Number(ttlSeconds || this.tokenTtlSeconds);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');
      const createdToken = await createAccessToken(client, {
        token,
        assetId,
        expiresAt,
      });
      await client.query('COMMIT');

      return createdToken;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrivateAssetByToken(token) {
    const access = await getAccessTokenWithAsset(this.db, token);
    if (!access) {
      throw httpError(401, 'Invalid or expired access token.');
    }

    if (new Date(access.expires_at).getTime() <= Date.now()) {
      throw httpError(401, 'Invalid or expired access token.');
    }

    const object = await this.storage.getObjectBuffer(
      access.object_storage_key,
    );

    return {
      access,
      object,
      cacheControl: resolveCacheControl({ isPrivate: true }),
    };
  }

  async purgeMutableAsset(assetId) {
    await this.getAssetMetadata(assetId);
    return this.cdnPurgeService.purgePaths([`/assets/${assetId}/download`]);
  }
}

module.exports = {
  AssetService,
  httpError,
};
