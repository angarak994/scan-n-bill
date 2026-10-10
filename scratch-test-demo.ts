import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = 'c28d5412-25fa-4c40-9a3d-42bcfe0f3408'; // random valid uuid
  
  console.log('Inserting business...');
  await supabase.from('businesses').insert({ id: businessId, business_name: 'Test', owner_name: 'Test', contact_number: '1234567890', google_sheet_id: '123', dashboard_pin: '1234' });

  const { data: c1, error } = await supabase.from('customers').insert({ business_id: businessId, name: 'Arjun Sharma', phone: '9876543210', outstanding_balance: 450 }).select('id').single();
  console.log('Error C1:', error);

  const { data: c2, error: err2 } = await supabase.from('sessions').insert({
    business_id: businessId, date: '2023-10-10', customer_name: 'Arjun Sharma', table_id: 'T1', game_type: 'pool',
    start_time: new Date().toISOString(), status: 'COMPLETED', payment_status: 'Pending', member_id: c1?.id
  });
  console.log('Error session:', err2);
}
test();
