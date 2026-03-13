require('dotenv').config();

const Fastify = require('fastify');
const multipart = require('@fastify/multipart');

const { createDb } = require('../config/database');
const { createStorage } = require('../config/storage');
const assetsRoutes = require('./routes/assets');
const { AssetService } = require('./services/assetService');
const { createCdnPurgeService } = require('./services/cdnPurgeService');
const { runMigrations } = require('./models/migrate');

async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.MAX_UPLOAD_BYTES || 52_428_800),
      files: 1,
    },
  });

  const db = options.db || createDb();
  const storage = options.storage || createStorage();
  const cdnPurgeService = options.cdnPurgeService || createCdnPurgeService();

  if (typeof storage.ensureBucket === 'function') {
    await storage.ensureBucket();
  }

  const originShieldConfig = options.originShieldConfig || {
    enabled: String(process.env.ORIGIN_SHIELD_ENABLED || 'false') === 'true',
    secret: process.env.ORIGIN_SHIELD_SECRET || '',
  };

  const assetService = new AssetService({
    db,
    storage,
    cdnPurgeService,
    tokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 300),
  });

  app.decorate('db', db);
  app.decorate('storage', storage);
  app.decorate('services', {
    assetService,
  });

  await app.register(assetsRoutes, {
    prefix: '/assets',
    originShieldConfig,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      request.log.error(error);
    }

    reply.code(statusCode).send({
      message: error.message || 'Internal server error',
    });
  });

  app.addHook('onClose', async () => {
    if (!options.db && db?.end) {
      await db.end();
    }
  });

  return app;
}

async function start() {
  const app = await buildApp();
  await runMigrations(app.db);

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
}

if (require.main === module) {
  start().catch((error) => {
     
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  buildApp,
};
