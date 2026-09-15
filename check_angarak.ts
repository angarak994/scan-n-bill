import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: customers } = await supabase.from('customers').select('id, name, business_id').ilike('name', '%Angarak%');
  console.log("Customers named Angarak:", customers);

  for (const c of customers || []) {
      const { data: b } = await supabase.from('businesses').select('business_name').eq('id', c.business_id).single();
      console.log(`- Belongs to business: ${b?.business_name} (${c.business_id})`);
  }
}
check();
