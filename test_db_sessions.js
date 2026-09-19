const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('sessions').select('id, cost, payment_status, amount_paid, status, date').eq('status', 'COMPLETED').order('created_at', { ascending: false }).limit(5);
  console.log("Recent Completed Sessions:", data);
}
test();
