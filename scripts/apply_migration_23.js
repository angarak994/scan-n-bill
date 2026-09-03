require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '23_whatsapp_integration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Supabase JS client doesn't support executing raw multi-statement SQL easily via API,
  // but we can try to call a standard RPC or we can split it.
  // Actually, we can just use the Postgres connection string if available, or we can use an RPC function if they have exec_sql.
  console.log('To apply this safely without an RPC, run this in your Supabase SQL Editor:');
  console.log(sql);
}

applyMigration().catch(console.error);
