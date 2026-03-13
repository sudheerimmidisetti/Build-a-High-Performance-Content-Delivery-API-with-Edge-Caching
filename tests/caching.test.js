const request = require('supertest');

const { createTestApp } = require('./helpers/testApp');

describe('Caching and security behavior', () => {
  test('public mutable and immutable headers are correct', async () => {
    const { app } = await createTestApp();
    const http = request(app.server);

    const upload = await http
      .post('/assets/upload')
      .attach('file', Buffer.from('mutable-body'), 'mutable.txt')
      .field('is_private', 'false');

    const mutable = await http.get(`/assets/${upload.body.id}/download`);
    expect(mutable.headers['cache-control']).toBe(
      'public, s-maxage=3600, max-age=60',
    );

    const publish = await http
      .post(`/assets/${upload.body.id}/publish`)
      .send({});
    const immutable = await http.get(
      `/assets/public/${publish.body.version_id}`,
    );
    expect(immutable.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );

    const revalidate = await http
      .get(`/assets/public/${publish.body.version_id}`)
      .set('If-None-Match', immutable.headers.etag);
    expect(revalidate.statusCode).toBe(304);

    await app.close();
  });

  test('expired private token is rejected', async () => {
    const { app } = await createTestApp();
    const http = request(app.server);

    const upload = await http
      .post('/assets/upload')
      .attach('file', Buffer.from('short-lived'), 'short.txt')
      .field('is_private', 'true');

    const token = await http
      .post(`/assets/${upload.body.id}/tokens`)
      .send({ ttl_seconds: 1 });
    expect(token.statusCode).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const expired = await http.get(`/assets/private/${token.body.token}`);
    expect(expired.statusCode).toBe(401);

    await app.close();
  });

  test('origin shielding blocks direct access without CDN header', async () => {
    const { app } = await createTestApp({
      originShieldConfig: {
        enabled: true,
        secret: 'edge-secret',
      },
    });

    const http = request(app.server);

    const upload = await http
      .post('/assets/upload')
      .attach('file', Buffer.from('shielded'), 'shielded.txt')
      .field('is_private', 'false');

    const blocked = await http.get(`/assets/${upload.body.id}/download`);
    expect(blocked.statusCode).toBe(403);

    const allowed = await http
      .get(`/assets/${upload.body.id}/download`)
      .set('x-origin-secret', 'edge-secret');
    expect(allowed.statusCode).toBe(200);

    await app.close();
  });
});
