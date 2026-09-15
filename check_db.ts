import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: customers, error: cErr } = await supabase.from('customers').select('*');
  console.log('Customers:', customers?.length, cErr);
  if (customers) console.log(customers.slice(0, 3));

  const { data: payments, error: pErr } = await supabase.from('payments').select('*');
  console.log('Payments:', payments?.length, pErr);
  if (payments) console.log(payments.slice(0, 3));
}
check();
