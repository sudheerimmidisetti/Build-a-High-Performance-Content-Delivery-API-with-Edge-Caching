const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');

async function streamToBuffer(stream) {
  if (typeof stream?.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

class S3Storage {
  constructor(options) {
    this.bucket = options.bucket;

    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      forcePathStyle: options.forcePathStyle,
    });
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (_error) {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putObject(input) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async copyObject(sourceKey, destinationKey, contentType) {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
        ContentType: contentType,
        MetadataDirective: 'REPLACE',
      }),
    );
  }

  async headObject(key) {
    const output = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      contentType: output.ContentType || 'application/octet-stream',
      contentLength: Number(output.ContentLength || 0),
      lastModified: output.LastModified || new Date(),
    };
  }

  async getObjectBuffer(key) {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const buffer = await streamToBuffer(output.Body);
    return {
      buffer,
      contentType: output.ContentType || 'application/octet-stream',
      contentLength: Number(output.ContentLength || buffer.length),
      lastModified: output.LastModified || new Date(),
    };
  }
}

module.exports = {
  S3Storage,
};
