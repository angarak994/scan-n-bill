import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const { data: b } = await supabase.from('businesses').select('id, business_name').order('created_at', { ascending: false }).limit(1).single();
  if (!b) return;
  const businessId = b.id;
  console.log("Testing on business:", businessId);

  // FETCH PAYMENTS
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
  console.log("Payments error:", qkError);
  console.log("Payments count:", qkhataEntries?.length);

  // FETCH SESSIONS
  const { data: sessionEntries, error: sessionError } = await supabase
      .from('sessions')
      .select(`
          id,
          cost,
          payment_status,
          customer_name,
          end_time,
          date
      `)
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED');
  console.log("Sessions error:", sessionError);
  console.log("Sessions count:", sessionEntries?.length);
}
test();
