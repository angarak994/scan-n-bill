const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, business_name, pricing_rules')
    .contains('pricing_rules', { globalSettings: { authorized_telegram_owners: [{ chatId: "123" }] } });
  
  console.log('Error:', error);
  console.log('Data count:', data?.length);
}
test();
