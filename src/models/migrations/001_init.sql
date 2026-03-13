CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY,
  object_storage_key VARCHAR(255) NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  etag VARCHAR(255) NOT NULL,
  current_version_id UUID,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_versions (
  id UUID PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  object_storage_key VARCHAR(255) NOT NULL UNIQUE,
  etag VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE assets
  ADD CONSTRAINT assets_current_version_id_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES asset_versions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS access_tokens (
  token VARCHAR(255) PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_current_version_id ON assets(current_version_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_asset_id ON access_tokens(asset_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON access_tokens(expires_at);
