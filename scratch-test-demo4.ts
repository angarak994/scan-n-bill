import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = 'c28d5412-25fa-4c40-9a3d-42bcfe0f3408';
  const { data: c1 } = await supabase.from('customers').select('id').eq('business_id', businessId).limit(1).single();
  
  if (c1) {
    const {error: payErr} = await supabase.from('payments').insert([
        { business_id: businessId, customer_id: c1.id, amount: 200, payment_method: 'QKhata', status: 'Pending', type: 'Charge', description: 'Table time (Arjun)' }
    ]);
    console.log('Payments error:', payErr);
  }
}
test();
