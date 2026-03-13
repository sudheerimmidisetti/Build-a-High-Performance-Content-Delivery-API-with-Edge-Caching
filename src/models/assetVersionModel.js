async function createAssetVersion(client, input) {
  const result = await client.query(
    `INSERT INTO asset_versions (
      id,
      asset_id,
      object_storage_key,
      etag,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING *`,
    [input.id, input.assetId, input.objectStorageKey, input.etag],
  );

  return result.rows[0];
}

async function getAssetVersionById(db, id) {
  const result = await db.query(
    `SELECT
      av.*,
      a.filename,
      a.mime_type,
      a.size_bytes,
      a.is_private
    FROM asset_versions av
    JOIN assets a ON a.id = av.asset_id
    WHERE av.id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  createAssetVersion,
  getAssetVersionById,
};
