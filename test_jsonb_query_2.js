const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, business_name, pricing_rules')
    .limit(1);
    
  if (data && data.length > 0) {
      console.log('Sample rules:', JSON.stringify(data[0].pricing_rules?.globalSettings?.authorized_telegram_owners));
  }
}
test();
