const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('businesses').select('*').limit(1);
  console.log("Businesses columns:", data && data.length > 0 ? Object.keys(data[0]) : error);
}
test();
