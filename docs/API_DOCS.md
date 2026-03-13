# API Documentation

Base URL: `http://localhost:3000`

## POST /assets/upload

Uploads a file and creates asset metadata.

Request:

- `multipart/form-data`
- `file` (required)
- `is_private` (optional, boolean)

Response: `201 Created`

```json
{
  "id": "uuid",
  "etag": "\"sha256hash\"",
  "filename": "hello.txt",
  "size": 123,
  "mime_type": "text/plain",
  "is_private": false,
  "current_version_id": "uuid"
}
```

## GET /assets/:id/download

Serves mutable asset content.

Headers:

- Accepts `If-None-Match`
- Returns `ETag`, `Last-Modified`, `Cache-Control`, `Content-Type`, `Content-Length`

Responses:

- `200 OK` with body
- `304 Not Modified` when ETag matches

## HEAD /assets/:id/download

Metadata only for mutable asset.

Responses:

- `200 OK` with caching/content headers and no body
- `304 Not Modified` when ETag matches

## POST /assets/:id/publish

Creates a new immutable version and updates `current_version_id`.

Request options:

- JSON `{ "new_content_key": "...", "filename": "..." }`
- or multipart file upload to replace mutable content while publishing

Response: `200 OK`

```json
{
  "id": "uuid",
  "current_version_id": "uuid",
  "etag": "\"sha256hash\"",
  "version_id": "uuid",
  "purge": {
    "purged": true
  }
}
```

## GET /assets/public/:version_id

Serves immutable public content.

Headers:

- `Cache-Control: public, max-age=31536000, immutable`
- `ETag`, `Last-Modified`, `Content-Type`, `Content-Length`

Responses:

- `200 OK`
- `304 Not Modified` when ETag matches

## GET /assets/private/:token

Serves private content for valid token.

Headers:

- `Cache-Control: private, no-store, no-cache, must-revalidate`
- `ETag`, `Last-Modified`, `Content-Type`, `Content-Length`

Responses:

- `200 OK`
- `401 Unauthorized` for invalid/expired token

## POST /assets/:id/tokens

Helper endpoint to create private access token.

Request JSON:

```json
{
  "ttl_seconds": 300
}
```

Response: `201 Created`

```json
{
  "token": "hex-token",
  "expires_at": "timestamp",
  "asset_id": "uuid"
}
```

## POST /assets/:id/purge

Manual CDN purge trigger for mutable path.

Response: `200 OK`

```json
{
  "purged": {
    "purged": true
  }
}
```
