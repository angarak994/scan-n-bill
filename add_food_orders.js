const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  if (!process.env.DATABASE_URL) {
      console.error("No DATABASE_URL found");
      return;
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
      await client.query(`
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS food_orders JSONB DEFAULT '[]'::jsonb;
      `);
      console.log("Added food_orders to sessions");
  } catch(e) {
      console.error("Migration failed:", e);
  } finally {
      await client.end();
  }
}
run();
