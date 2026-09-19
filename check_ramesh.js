const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .ilike('customer_name', '%Ramesh%');

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Ramesh Sessions:', JSON.stringify(data, null, 2));
  }
}

main();
