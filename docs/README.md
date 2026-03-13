# Build a High-Performance Content Delivery API with Edge Caching

## Overview

This project implements a **high-performance content delivery API**
designed to efficiently serve files to users around the world.\
It uses **modern HTTP caching strategies**, **CDN integration**, and
**object storage** to significantly reduce latency and minimize load on
the origin server.

The system supports **secure file uploads, versioned content delivery,
private asset access using secure tokens, and intelligent caching**
using ETags and Cache-Control headers.

The goal of this project is to demonstrate how large-scale platforms
deliver static and dynamic assets quickly while maintaining security and
scalability.

------------------------------------------------------------------------

# Key Features

### 1. File Upload and Asset Management

Users can upload files which are stored in object storage.\
Metadata about each file (size, type, ETag, version, etc.) is stored in
PostgreSQL.

### 2. Strong HTTP Caching with ETags

Each file receives a **strong ETag (SHA-256 hash)** when uploaded.\
Clients can send `If-None-Match` headers, allowing the server to return:

-   `304 Not Modified` if content hasn't changed
-   `200 OK` with the file if content is updated

This reduces unnecessary downloads and improves performance.

### 3. Immutable Versioned Assets

Assets can be **published as immutable versions**.\
Each version receives its own storage key and can be cached by CDNs for
long periods.

Example caching policy:

    Cache-Control: public, max-age=31536000, immutable

This allows CDNs to cache files for up to one year.

### 4. Secure Private Content Access

Private assets are protected using **temporary cryptographically secure
tokens**.

Features include:

-   Short-lived access tokens
-   Expiration validation
-   Unauthorized access protection

Private responses use:

    Cache-Control: private, no-store, no-cache, must-revalidate

### 5. CDN Integration

The system is designed to work with CDNs such as:

-   Cloudflare
-   AWS CloudFront
-   Fastly

Public assets can achieve **95%+ cache hit ratios**, drastically
reducing origin load.

### 6. CDN Cache Invalidation

When mutable assets change, the API can trigger a **programmatic CDN
purge** to ensure users receive updated content.

### 7. Origin Shielding

To prevent users from bypassing the CDN, the API includes **origin
shielding middleware** that restricts direct traffic.

------------------------------------------------------------------------

# Technology Stack

Backend Framework - Node.js - Fastify

Database - PostgreSQL

Object Storage - AWS S3 compatible storage - MinIO (used for local
development)

Testing - Jest - Supertest

Infrastructure - Docker - Docker Compose

Benchmarking - Python benchmark script

------------------------------------------------------------------------

# Project Structure

```
Build-a-High-Performance-Content-Delivery-API-with-Edge-Caching/
│
├── .env.example
├── .flake8
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
├── submission.yml
├── README.md
│
├── config/
│   ├── cache.js
│   ├── database.js
│   └── storage.js
│
├── docs/
│   ├── API_DOCS.md
│   ├── ARCHITECTURE.md
│   ├── PERFORMANCE.md
│   └── README.md
│
├── scripts/
│   └── run_benchmark.py
│
├── src/
│   ├── server.js
│   │
│   ├── controllers/
│   │   └── assetsController.js
│   │
│   ├── middleware/
│   │   └── originShield.js
│   │
│   ├── models/
│   │   ├── accessTokenModel.js
│   │   ├── assetModel.js
│   │   ├── assetVersionModel.js
│   │   ├── migrate-cli.js
│   │   ├── migrate.js
│   │   └── migrations/
│   │       └── 001_init.sql
│   │
│   ├── routes/
│   │   └── assets.js
│   │
│   ├── services/
│   │   ├── assetService.js
│   │   └── cdnPurgeService.js
│   │
│   ├── storage/
│   │   └── s3Storage.js
│   │
│   └── utils/
│       ├── etag.js
│       ├── hash.js
│       └── token.js
│
└── tests/
    ├── asset.test.js
    ├── caching.test.js
    └── helpers/
        ├── inMemoryStorage.js
        └── testApp.js
```

------------------------------------------------------------------------

# API Endpoints

### Upload Asset

    POST /assets/upload

Uploads a file and stores it in object storage.\
Returns metadata including ID, size, MIME type, and ETag.

------------------------------------------------------------------------

### Download Asset

    GET /assets/:id/download

Supports conditional requests using:

    If-None-Match

Responses: - `200 OK` if file changed - `304 Not Modified` if file
unchanged

------------------------------------------------------------------------

### Check Asset Metadata

    HEAD /assets/:id/download

Returns headers such as:

-   Content-Type
-   Content-Length
-   ETag
-   Last-Modified

without sending the file body.

------------------------------------------------------------------------

### Publish New Version

    POST /assets/:id/publish

Creates an **immutable version** of the asset and updates the current
version reference.

------------------------------------------------------------------------

### Access Public Versioned Asset

    GET /assets/public/:version_id

Highly cacheable endpoint designed for CDN delivery.

    Cache-Control: public, max-age=31536000, immutable

------------------------------------------------------------------------

### Access Private Asset

    GET /assets/private/:token

Allows access to private assets only if the provided token:

-   Exists
-   Is valid
-   Has not expired

------------------------------------------------------------------------

# Running the Project

### Start with Docker

    docker compose up --build -d

This will start:

-   API service
-   PostgreSQL
-   MinIO object storage

------------------------------------------------------------------------

# Running Tests

Inside the container:

    docker compose exec -T app npm test

Or locally:

    npm test

The test suite verifies:

-   API endpoints
-   Caching logic
-   Security controls
-   Token validation

------------------------------------------------------------------------

# Benchmark Testing

Run the benchmark script:

    docker compose exec -T app python scripts/run_benchmark.py

The script measures:

-   Success rate
-   Average latency
-   P95 latency
-   Cache hit ratio
-   Response distribution

Results are summarized in `docs/PERFORMANCE.md`.

------------------------------------------------------------------------

# Security Considerations

This project includes several important security measures:

-   Secure token generation for private assets
-   Token expiration validation
-   Origin shielding to prevent direct origin access
-   Safe handling of caching headers
-   Controlled CDN invalidation

------------------------------------------------------------------------
