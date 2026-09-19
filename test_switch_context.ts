import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } });

async function run() {
  const chatId = "5921855685"; // Sample chat ID, we will find an actual one.
  const { data: b } = await supabase.from('businesses').select('id, business_name, pricing_rules');
  console.log(JSON.stringify(b, null, 2));
}
run();
