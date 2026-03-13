# Edge Caching Content Delivery API

Production-grade content delivery API using Fastify, PostgreSQL, and MinIO with CDN-ready caching semantics.

## Highlights

- Strong SHA-256 ETag generation at upload/update time.
- Conditional GET and HEAD support with `If-None-Match`.
- Cache policies for immutable, mutable, and private assets.
- Immutable versioning model via `asset_versions`.
- Secure short-lived token access for private assets.
- Origin shielding middleware to simulate CDN-only origin access.
- CDN purge integration for mutable assets.
- Jest + Supertest automated tests (>=70% coverage threshold).
- Python benchmark script for latency and cache-hit evaluation.

## Quick Start

1. Copy env template:

```bash
cp .env.example .env
```

1. Start stack:

```bash
docker compose up --build
```

1. API base URL:

```text
http://localhost:3000
```

## Run Tests

```bash
docker compose exec app npm test
```

## Run Benchmark

```bash
docker compose exec app python scripts/run_benchmark.py
```

## Endpoints

- `POST /assets/upload`
- `GET /assets/:id/download`
- `HEAD /assets/:id/download`
- `POST /assets/:id/publish`
- `GET /assets/public/:version_id`
- `GET /assets/private/:token`
- `POST /assets/:id/tokens` (helper for private testing)
- `POST /assets/:id/purge` (manual mutable CDN purge)

See `docs/API_DOCS.md` for full request/response details.
