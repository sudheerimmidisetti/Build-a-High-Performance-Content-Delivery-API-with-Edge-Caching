const fs = require('fs');
const path = require('path');

async function runMigrations(db, options = {}) {
  const migrationsDir =
    options.migrationsDir || path.join(__dirname, 'migrations');

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of files) {
    const exists = await db.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [filename],
    );
    if (exists.rows.length > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(filename) VALUES ($1)',
        [filename],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  runMigrations,
};
