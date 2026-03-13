const request = require('supertest');

const { createTestApp } = require('./helpers/testApp');

describe('Asset API', () => {
  let app;
  let http;
  let publicAssetId;
  let privateAssetId;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    http = request(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /assets/upload uploads a public asset and returns metadata', async () => {
    const response = await http
      .post('/assets/upload')
      .attach('file', Buffer.from('hello-edge-cache'), 'hello.txt')
      .field('is_private', 'false');

    expect(response.statusCode).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.current_version_id).toBeDefined();
    expect(response.body.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(response.body.filename).toBe('hello.txt');
    expect(response.body.size).toBe(16);

    publicAssetId = response.body.id;
  });

  test('GET /assets/:id/download returns content with caching headers', async () => {
    const response = await http.get(`/assets/${publicAssetId}/download`);

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBeDefined();
    expect(response.headers['last-modified']).toBeDefined();
    expect(response.headers['cache-control']).toBe(
      'public, s-maxage=3600, max-age=60',
    );
    expect(response.text).toBe('hello-edge-cache');
  });

  test('GET /assets/:id/download handles If-None-Match and returns 304', async () => {
    const first = await http.get(`/assets/${publicAssetId}/download`);

    const response = await http
      .get(`/assets/${publicAssetId}/download`)
      .set('If-None-Match', first.headers.etag);

    expect(response.statusCode).toBe(304);
    expect(response.text).toBe('');
  });

  test('HEAD /assets/:id/download returns metadata only', async () => {
    const response = await http.head(`/assets/${publicAssetId}/download`);

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBeDefined();
    expect(response.headers['content-length']).toBe('16');
  });

  test('POST /assets/:id/publish creates a new immutable version', async () => {
    const response = await http
      .post(`/assets/${publicAssetId}/publish`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(response.body.version_id).toBeDefined();
    expect(response.body.current_version_id).toBe(response.body.version_id);

    const publicVersionResponse = await http.get(
      `/assets/public/${response.body.version_id}`,
    );
    expect(publicVersionResponse.statusCode).toBe(200);
    expect(publicVersionResponse.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(publicVersionResponse.text).toBe('hello-edge-cache');
  });

  test('GET /assets/private/:token validates secure private token', async () => {
    const uploadPrivate = await http
      .post('/assets/upload')
      .attach('file', Buffer.from('private-content'), 'private.txt')
      .field('is_private', 'true');

    expect(uploadPrivate.statusCode).toBe(201);
    privateAssetId = uploadPrivate.body.id;

    const tokenResponse = await http
      .post(`/assets/${privateAssetId}/tokens`)
      .send({ ttl_seconds: 120 });
    expect(tokenResponse.statusCode).toBe(201);
    expect(tokenResponse.body.token).toMatch(/^[a-f0-9]{64}$/);

    const privateFetch = await http.get(
      `/assets/private/${tokenResponse.body.token}`,
    );
    expect(privateFetch.statusCode).toBe(200);
    expect(privateFetch.headers['cache-control']).toBe(
      'private, no-store, no-cache, must-revalidate',
    );
    expect(privateFetch.text).toBe('private-content');

    const invalidFetch = await http.get('/assets/private/not-a-valid-token');
    expect(invalidFetch.statusCode).toBe(401);
  });
});
