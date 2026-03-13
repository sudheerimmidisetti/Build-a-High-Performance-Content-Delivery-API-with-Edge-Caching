const { buildOriginShieldMiddleware } = require('../middleware/originShield');
const { createAssetsController } = require('../controllers/assetsController');

async function assetsRoutes(fastify, options) {
  const controller = createAssetsController(fastify);
  const originShield = buildOriginShieldMiddleware(
    options.originShieldConfig || {},
  );

  fastify.post('/upload', controller.uploadAsset);

  fastify.get(
    '/:id/download',
    { preHandler: originShield, exposeHeadRoute: false },
    controller.downloadAsset,
  );
  fastify.head(
    '/:id/download',
    { preHandler: originShield },
    controller.headAsset,
  );

  fastify.post('/:id/publish', controller.publishAsset);
  fastify.post('/:id/tokens', controller.createAccessToken);
  fastify.post('/:id/purge', controller.purgeAsset);

  fastify.get(
    '/public/:version_id',
    { preHandler: originShield },
    controller.getPublicAsset,
  );
  fastify.get(
    '/private/:token',
    { preHandler: originShield },
    controller.getPrivateAsset,
  );
}

module.exports = assetsRoutes;
