import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = crypto.randomUUID();

  // Create business
  const { data: bData, error: bErr } = await supabase.from('businesses').insert({
    id: businessId,
    business_name: 'Strike Zone (Demo)',
    owner_name: 'Demo Admin',
    contact_number: '9999999999',
    dashboard_pin: '1234',
    google_sheet_id: 'test'
  }).select('id').single();

  console.log("Business creation:", bErr);

  try {
    const endOfNextMonth = new Date();
    endOfNextMonth.setMonth(endOfNextMonth.getMonth() + 1);
    const {error: pErr} = await supabase.from('promotions').insert({
        business_id: businessId, 
        name: 'DIWALI50', 
        discount_percent: 50, 
        start_time: new Date().toISOString(),
        end_time: endOfNextMonth.toISOString(),
        status: 'Active'
    });
    console.log("Promotions:", pErr);
  } catch(demoErr) {
    console.error(demoErr);
  }
}
test();
