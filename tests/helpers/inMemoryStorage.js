class InMemoryStorage {
  constructor() {
    this.objects = new Map();
  }

  async ensureBucket() {
    return undefined;
  }

  async putObject(input) {
    this.objects.set(input.key, {
      buffer: Buffer.from(input.body),
      contentType: input.contentType || 'application/octet-stream',
      lastModified: new Date(),
    });
  }

  async copyObject(sourceKey, destinationKey, contentType) {
    const source = this.objects.get(sourceKey);
    if (!source) {
      const error = new Error('Object not found');
      error.statusCode = 404;
      throw error;
    }

    this.objects.set(destinationKey, {
      buffer: Buffer.from(source.buffer),
      contentType: contentType || source.contentType,
      lastModified: new Date(),
    });
  }

  async headObject(key) {
    const object = this.objects.get(key);
    if (!object) {
      const error = new Error('Object not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      contentType: object.contentType,
      contentLength: object.buffer.length,
      lastModified: object.lastModified,
    };
  }

  async getObjectBuffer(key) {
    const object = this.objects.get(key);
    if (!object) {
      const error = new Error('Object not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      buffer: Buffer.from(object.buffer),
      contentType: object.contentType,
      contentLength: object.buffer.length,
      lastModified: object.lastModified,
    };
  }
}

module.exports = {
  InMemoryStorage,
};
