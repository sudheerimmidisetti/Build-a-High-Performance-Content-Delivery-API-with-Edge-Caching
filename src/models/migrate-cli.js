require('dotenv').config();

const { createDb } = require('../../config/database');
const { runMigrations } = require('./migrate');

async function main() {
  const db = createDb();

  try {
    await runMigrations(db);
     
    console.log('Migrations applied successfully');
  } finally {
    await db.end();
  }
}

main().catch((error) => {
   
  console.error('Migration failed', error);
  process.exit(1);
});
