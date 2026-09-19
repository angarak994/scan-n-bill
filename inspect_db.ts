import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: businesses } = await supabase.from('businesses').select('id, business_name').limit(1);
  if (!businesses || businesses.length === 0) return console.log('No businesses found');
  const bid = businesses[0].id;
  
  const { data: members } = await supabase.from('memberships').select('*').eq('business_id', bid);
  console.log('Members:', members?.length);
  
  const { data: customers } = await supabase.from('customers').select('*').eq('business_id', bid);
  console.log('Customers:', customers?.length);
  
  if (customers && customers.length > 0) {
      console.log('Sample customer:', customers[0]);
  }
}
inspect();
