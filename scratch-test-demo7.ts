import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = crypto.randomUUID();

  // Create business
  await supabase.from('businesses').insert({
    id: businessId,
    business_name: 'Strike Zone (Demo)',
    owner_name: 'Demo Admin',
    contact_number: '9999999999',
    dashboard_pin: '1234',
    google_sheet_id: 'test'
  }).select('id').single();

  const endOfNextMonth = new Date();
  endOfNextMonth.setMonth(endOfNextMonth.getMonth() + 1);
  await supabase.from('promotions').insert({
      business_id: businessId, 
      name: 'DIWALI50', 
      discount_percent: 50, 
      start_time: new Date().toISOString(),
      end_time: endOfNextMonth.toISOString(),
      status: 'Active'
  });

  const { data: c1 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Arjun Sharma', phone: '9876543210', outstanding_balance: 1450 }).select('id').single();
  const { data: c2 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Priya Patel', phone: '9123456789', outstanding_balance: 0 }).select('id').single();
  const { data: c3 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Rohit Verma', phone: '9001122334', outstanding_balance: -200 }).select('id').single();
    
  await supabase.from('payments').insert([
      { business_id: businessId, customer_id: c2?.id, amount: 400, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time (Priya)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
      { business_id: businessId, amount: 200, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Anjali)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
      { business_id: businessId, customer_id: c1?.id, amount: 200, payment_method: 'QKhata', status: 'Pending', metadata: { description: 'Table time (Arjun)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
      { business_id: businessId, customer_id: c3?.id, amount: 850, payment_method: 'Card', status: 'Paid', metadata: { description: 'VIP Snooker & Food (Rohit)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
      { business_id: businessId, amount: 420, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time & Food (Rahul)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
      { business_id: businessId, customer_id: c1?.id, amount: 500, payment_method: 'UPI', status: 'Paid', metadata: { description: 'QKhata Partial Settlement' }, created_at: new Date().toISOString() },
      { business_id: businessId, amount: 400, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Karan)' }, created_at: new Date().toISOString() }
  ]);

  // TEST FINANCIAL OVERVIEW QUERY
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
  console.log("Data count:", qkhataEntries?.length);
  console.log("Sample Data:", qkhataEntries?.[0]);
}
test();
