# Architecture

## Components

- API Layer: Fastify route/controller modules under `src/routes` and `src/controllers`.
- Service Layer: `src/services/assetService.js` for orchestration and `src/services/cdnPurgeService.js` for CDN purge.
- Persistence Layer: PostgreSQL repositories in `src/models`.
- Object Storage Layer: S3-compatible storage adapter in `src/storage/s3Storage.js` (MinIO for development).
- Caching Strategy: centralized cache header resolution in `config/cache.js`.

## Data Flow

1. Upload

- Client uploads multipart file to `POST /assets/upload`.
- API computes SHA-256 hash and stores strong ETag.
- File is written to mutable key and immutable version key in object storage.
- Metadata is persisted in `assets` and `asset_versions`.

1. Mutable Download

- `GET /assets/:id/download` checks `If-None-Match` against stored ETag.
- Returns `304` when matched, otherwise `200` with body and mutable cache headers.

1. Version Publish

- `POST /assets/:id/publish` creates a new immutable version key.
- Updates `assets.current_version_id`.
- Triggers CDN purge for mutable path `/assets/:id/download`.

1. Immutable Public Delivery

- `GET /assets/public/:version_id` serves immutable asset version.
- Sends `Cache-Control: public, max-age=31536000, immutable`.

1. Private Delivery

- `GET /assets/private/:token` validates cryptographically secure token and expiration.
- Serves private content with strict no-store cache directives.

## Scalability Notes

- Stateless API nodes can scale horizontally.
- CDN edge caching offloads repeat public traffic from origin.
- Immutable version URLs eliminate invalidation pressure.
- Mutable content uses explicit purge and short origin max-age.
- Object storage decouples binary delivery from compute nodes.

## Security Notes

- Origin shield middleware blocks direct origin access unless secret header is present.
- Private access tokens are random 256-bit hex strings and expire quickly.
- Private responses use `private, no-store, no-cache, must-revalidate`.
