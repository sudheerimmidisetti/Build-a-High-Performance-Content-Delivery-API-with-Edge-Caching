async function createAsset(client, input) {
  const result = await client.query(
    `INSERT INTO assets (
      id,
      object_storage_key,
      filename,
      mime_type,
      size_bytes,
      etag,
      current_version_id,
      is_private,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING *`,
    [
      input.id,
      input.objectStorageKey,
      input.filename,
      input.mimeType,
      input.sizeBytes,
      input.etag,
      input.currentVersionId,
      input.isPrivate,
    ],
  );

  return result.rows[0];
}

async function getAssetById(db, id) {
  const result = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateAssetContent(client, input) {
  const result = await client.query(
    `UPDATE assets
      SET object_storage_key = $2,
          filename = $3,
          mime_type = $4,
          size_bytes = $5,
          etag = $6,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      input.id,
      input.objectStorageKey,
      input.filename,
      input.mimeType,
      input.sizeBytes,
      input.etag,
    ],
  );

  return result.rows[0] || null;
}

async function setCurrentVersion(client, input) {
  const result = await client.query(
    `UPDATE assets
      SET current_version_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [input.id, input.currentVersionId],
  );

  return result.rows[0] || null;
}

module.exports = {
  createAsset,
  getAssetById,
  setCurrentVersion,
  updateAssetContent,
};
