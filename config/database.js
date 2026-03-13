const { Pool } = require('pg');

function createDb(overrides = {}) {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/edge_cache';
  const max = Number(process.env.DB_POOL_MAX || 20);

  const pool =
    overrides.pool ||
    new Pool({
      connectionString,
      max,
    });

  return {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    end: () => pool.end(),
  };
}

module.exports = {
  createDb,
};
