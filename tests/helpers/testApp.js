const { newDb } = require('pg-mem');

const { buildApp } = require('../../src/server');
const { runMigrations } = require('../../src/models/migrate');
const { InMemoryStorage } = require('./inMemoryStorage');

function createTestDb() {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = memoryDb.adapters.createPg();
  const pool = new Pool();

  return {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    end: () => pool.end(),
  };
}

async function createTestApp(options = {}) {
  const db = createTestDb();
  await runMigrations(db);

  const storage = new InMemoryStorage();
  const purgeCalls = [];

  const app = await buildApp({
    logger: false,
    db,
    storage,
    originShieldConfig: options.originShieldConfig || {
      enabled: false,
      secret: 'test-secret',
    },
    cdnPurgeService: {
      purgePaths: async (paths) => {
        purgeCalls.push(paths);
        return { purged: true, paths };
      },
    },
  });

  await app.ready();

  return {
    app,
    db,
    storage,
    purgeCalls,
  };
}

module.exports = {
  createTestApp,
};
