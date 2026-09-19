const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data } = await supabase.from('businesses').select('pricing_rules');
  for (const b of data) {
    const owners = b?.pricing_rules?.globalSettings?.authorized_telegram_owners;
    if (owners && owners.length > 0) {
        console.log('Type of chatId:', typeof owners[0].chatId, owners[0].chatId);
        return;
    }
  }
  console.log('No owners found.');
}
test();
