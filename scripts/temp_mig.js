const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join('=').replace(/^"(.*)"$/, '$1').trim();
    }
  }
});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('/Users/angaraktate/Downloads/QR-based-billing/supabase/migrations/12_chat_history.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(() => ({}));
  if (error) {
     console.log("Could not run exec_sql:", error);
  } else {
     console.log("Migration applied via rpc.");
  }
}
run();
