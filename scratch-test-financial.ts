import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = 'c28d5412-25fa-4c40-9a3d-42bcfe0f3408'; // random valid uuid

  const { data: qkhataEntries, error: qkError } = await supabase
        .from('payments')
        .select(`
            id,
            amount,
            status,
            payment_method,
            created_at,
            customers!left(name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

  console.log("Error:", qkError);
  console.log("Data:", qkhataEntries);
}
test();
