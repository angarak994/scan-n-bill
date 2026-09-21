const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const sql = fs.readFileSync('supabase/migrations/33_saas_subscriptions.sql', 'utf8');
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
      await client.query(sql);
      console.log("Migration executed successfully!");
  } catch(e) {
      console.error("Migration failed:", e);
  } finally {
      await client.end();
  }
}
run();
