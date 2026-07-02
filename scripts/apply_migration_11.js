require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('./supabase/migrations/11_add_notes.sql', 'utf8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
       console.log("Could not run exec_sql:", error);
    } else {
       console.log("Migration applied via rpc.");
    }
  } catch (e) {
    console.log("Exception:", e.message);
  }
}
run();
