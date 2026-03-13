async function createAccessToken(client, input) {
  const result = await client.query(
    `INSERT INTO access_tokens (
      token,
      asset_id,
      expires_at,
      created_at
    ) VALUES ($1, $2, $3, NOW())
    RETURNING *`,
    [input.token, input.assetId, input.expiresAt],
  );

  return result.rows[0];
}

async function getAccessTokenWithAsset(db, token) {
  const result = await db.query(
    `SELECT
      t.token,
      t.expires_at,
      a.id AS asset_id,
      a.object_storage_key,
      a.filename,
      a.mime_type,
      a.size_bytes,
      a.etag,
      a.is_private,
      a.updated_at
    FROM access_tokens t
    JOIN assets a ON a.id = t.asset_id
    WHERE t.token = $1`,
    [token],
  );

  return result.rows[0] || null;
}

module.exports = {
  createAccessToken,
  getAccessTokenWithAsset,
};
