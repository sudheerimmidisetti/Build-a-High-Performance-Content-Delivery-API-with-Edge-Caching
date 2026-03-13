const { S3Storage } = require('../src/storage/s3Storage');

function createStorage() {
  return new S3Storage({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'edge-assets',
    forcePathStyle:
      String(process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  });
}

module.exports = {
  createStorage,
};
