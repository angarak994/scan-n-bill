import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = 'c28d5412-25fa-4c40-9a3d-42bcfe0f3408'; // random valid uuid

  const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
  const { data: m1, error: e1 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Arjun Sharma', mobile: '9876543210', tier: 'Gold', expiry_date: expiry }).select('id').single();
  const { data: m2, error: e2 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Priya Patel', mobile: '9123456789', tier: 'Standard', expiry_date: expiry }).select('id').single();
  const { data: m3, error: e3 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Rohit Verma', mobile: '9001122334', tier: 'Platinum', expiry_date: expiry }).select('id').single();

  const { data: c1, error: e4 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Arjun Sharma', phone: '9876543210', outstanding_balance: 1450 }).select('id').single();
  const { data: c2, error: e5 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Priya Patel', phone: '9123456789', outstanding_balance: 0 }).select('id').single();
  const { data: c3, error: e6 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Rohit Verma', phone: '9001122334', outstanding_balance: -200 }).select('id').single();

  console.log("M/C Errors:", e1, e2, e3, e4, e5, e6);

  if (m1 && m2 && c1 && c2 && c3 && m3) {
      const todayDate = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const twoDaysAgoDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

      const {error: sessErr} = await supabase.from('sessions').insert([
        { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Priya Patel', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m2.id },
        { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Anjali Desai (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
        { business_id: businessId, date: yesterdayDate, customer_name: 'Arjun Sharma', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Pending', completed_by: 'Demo System', member_id: m1.id },
        { business_id: businessId, date: yesterdayDate, customer_name: 'Rohit Verma', table_id: 'VIP1', game_type: 'snooker', start_time: new Date(Date.now() - 86400000 - 10800000).toISOString(), end_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), duration: '2h 0m', cost: 850, base_cost: 600, food_cost: 250, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m3.id },
        { business_id: businessId, date: yesterdayDate, customer_name: 'Rahul Kumar (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 86400000 - 1800000).toISOString(), duration: '1h 30m', cost: 420, base_cost: 300, food_cost: 120, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
        { business_id: businessId, date: todayDate, customer_name: 'Karan Singh (Guest)', table_id: 'T4', game_type: 'pool', start_time: new Date(Date.now() - 14400000).toISOString(), end_time: new Date(Date.now() - 7200000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo Admin' }
      ]);
      console.log('Session error:', sessErr);

      const futureTime1 = new Date(Date.now() + 3600000).toTimeString().substring(0, 5); 
      const {error: bookErr} = await supabase.from('bookings').insert([
        { business_id: businessId, customer_name: 'Arjun Sharma', customer_phone: '9876543210', table_id: 'T1', booking_date: todayDate, start_time: futureTime1, duration_minutes: 120, status: 'confirmed', source: 'whatsapp', game_type: 'pool' }
      ]);
      console.log('Bookings error:', bookErr);
  }
}
test();
