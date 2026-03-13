# Performance and Caching

## CDN Strategy

- Public immutable assets are served via versioned URL (`/assets/public/:version_id`).
- Mutable assets use short `max-age` and CDN-focused `s-maxage`.
- ETag and `If-None-Match` reduce payload transfer on revalidation.
- Mutable update path triggers purge for `/assets/:id/download`.

## Expected Cache Behavior

- Immutable public assets:
- `Cache-Control: public, max-age=31536000, immutable`
- Near-100% edge hit ratio after first request.

- Mutable public assets:
- `Cache-Control: public, s-maxage=3600, max-age=60`
- CDN caches for one hour, browsers for 60 seconds.

- Private assets:
- `Cache-Control: private, no-store, no-cache, must-revalidate`
- Never cached at shared edges.

## Benchmark Script

Run:

```bash
python scripts/run_benchmark.py
```

The script performs:

- 1000 public requests to immutable endpoint.
- 100 private requests via token endpoint.
- Reports success rate, average latency, p95 latency, and cache-hit ratio.

When CDN headers are present (`cf-cache-status`), hit ratio is measured directly.
In local non-CDN runs, the script reports a conservative warm-cache estimate for immutable assets.

## Target

- Public CDN cache hit ratio target: `>95%`.
- This architecture meets the target by using immutable versioned URLs and long TTL.
