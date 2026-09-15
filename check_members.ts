import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: businesses } = await supabase.from('businesses').select('id, business_name');
  console.log("Businesses:", businesses);

  const { data: customers } = await supabase.from('customers').select('id, name, business_id');
  
  const counts: Record<string, number> = {};
  for (const c of customers || []) {
      if (!counts[c.business_id]) counts[c.business_id] = 0;
      counts[c.business_id]++;
  }
  
  console.log("Customer counts by business_id:");
  for (const [bId, count] of Object.entries(counts)) {
      const bName = businesses?.find(b => b.id === bId)?.business_name || 'Unknown';
      console.log(`- ${bName} (${bId}): ${count} customers`);
  }
}
check();
