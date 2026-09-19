const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  if (error) console.log("ERROR", error);
  console.log("Keys:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
}
run();
