import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function test() {
  const businessId = crypto.randomUUID();

  // Create business
  const { data: bData, error: bErr } = await supabase.from('businesses').insert({
    id: businessId,
    business_name: 'Strike Zone (Demo)',
    owner_name: 'Demo Admin',
    contact_number: '9999999999',
    dashboard_pin: '1234',
    google_sheet_id: 'test'
  }).select('id').single();

  console.log("Business creation:", bErr);

  try {
    // 1. Memberships
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: m1 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Arjun Sharma', mobile: '9876543210', tier: 'Gold', expiry_date: expiry }).select('id').single();
    const { data: m2 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Priya Patel', mobile: '9123456789', tier: 'Standard', expiry_date: expiry }).select('id').single();
    const { data: m3, error: e3 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Rohit Verma', mobile: '9001122334', tier: 'Platinum', expiry_date: expiry }).select('id').single();
    
    console.log("Memberships:", m1?.id, m2?.id, m3?.id, e3);

    // 2. Customers
    const { data: c1 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Arjun Sharma', phone: '9876543210', outstanding_balance: 1450 }).select('id').single();
    const { data: c2 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Priya Patel', phone: '9123456789', outstanding_balance: 0 }).select('id').single();
    const { data: c3, error: e6 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Rohit Verma', phone: '9001122334', outstanding_balance: -200 }).select('id').single();
    
    console.log("Customers:", c1?.id, c2?.id, c3?.id, e6);

    if (m1 && m2 && c1 && c2 && c3 && m3) {
        const todayDate = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const twoDaysAgoDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

        // 3. Sessions
        const {error: sErr} = await supabase.from('sessions').insert([
            { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Priya Patel', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m2.id },
            { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Anjali Desai (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
            { business_id: businessId, date: yesterdayDate, customer_name: 'Arjun Sharma', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Pending', completed_by: 'Demo System', member_id: m1.id },
            { business_id: businessId, date: yesterdayDate, customer_name: 'Rohit Verma', table_id: 'VIP1', game_type: 'snooker', start_time: new Date(Date.now() - 86400000 - 10800000).toISOString(), end_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), duration: '2h 0m', cost: 850, base_cost: 600, food_cost: 250, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m3.id },
            { business_id: businessId, date: yesterdayDate, customer_name: 'Rahul Kumar (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 86400000 - 1800000).toISOString(), duration: '1h 30m', cost: 420, base_cost: 300, food_cost: 120, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
            { business_id: businessId, date: todayDate, customer_name: 'Karan Singh (Guest)', table_id: 'T4', game_type: 'pool', start_time: new Date(Date.now() - 14400000).toISOString(), end_time: new Date(Date.now() - 7200000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo Admin' }
        ]);
        console.log("Sessions:", sErr);
        
        // 4. Active Sessions
        const {error: aErr} = await supabase.from('sessions').insert([
            { business_id: businessId, date: todayDate, customer_name: 'Priya Patel', table_id: 'T3', game_type: 'pool', start_time: new Date(Date.now() - 1800000).toISOString(), status: 'ACTIVE', member_id: m2.id },
            { business_id: businessId, date: todayDate, customer_name: 'Guest 101', table_id: 'T5', game_type: 'snooker', start_time: new Date(Date.now() - 5400000).toISOString(), status: 'ACTIVE' }
        ]);
        console.log("Active Sessions:", aErr);

        // 5. Bookings
        const futureTime1 = new Date(Date.now() + 3600000).toTimeString().substring(0, 5); 
        const futureTime2 = new Date(Date.now() + 10800000).toTimeString().substring(0, 5); 
        const {error: bErr} = await supabase.from('bookings').insert([
            { business_id: businessId, customer_name: 'Arjun Sharma', customer_phone: '9876543210', table_id: 'T1', booking_date: todayDate, start_time: futureTime1, duration_minutes: 120, status: 'confirmed', source: 'whatsapp', game_type: 'pool' },
            { business_id: businessId, customer_name: 'Vikram Mehta', customer_phone: '9988112233', table_id: 'VIP1', booking_date: todayDate, start_time: futureTime2, duration_minutes: 60, status: 'confirmed', source: 'manual', game_type: 'snooker' }
        ]);
        console.log("Bookings:", bErr);

        // 6. Promotions
        const {error: pErr} = await supabase.from('promotions').insert({
            business_id: businessId, code: 'DIWALI50', discount_type: 'percentage', discount_value: 50, min_duration_minutes: 60, is_active: true
        });
        console.log("Promotions:", pErr);
        
        // 7. Payments
        const {error: payErr} = await supabase.from('payments').insert([
            { business_id: businessId, customer_id: c2.id, amount: 400, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time (Priya)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
            { business_id: businessId, amount: 200, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Anjali)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
            { business_id: businessId, customer_id: c1.id, amount: 200, payment_method: 'QKhata', status: 'Pending', metadata: { description: 'Table time (Arjun)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
            { business_id: businessId, customer_id: c3.id, amount: 850, payment_method: 'Card', status: 'Paid', metadata: { description: 'VIP Snooker & Food (Rohit)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
            { business_id: businessId, amount: 420, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time & Food (Rahul)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
            { business_id: businessId, customer_id: c1.id, amount: 500, payment_method: 'UPI', status: 'Paid', metadata: { description: 'QKhata Partial Settlement' }, created_at: new Date(Date.now() - 43200000).toISOString() },
            { business_id: businessId, amount: 400, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Karan)' }, created_at: new Date(Date.now() - 7200000).toISOString() }
        ]);
        console.log("Payments:", payErr);
    }
  } catch(demoErr) {
    console.error(demoErr);
  }
}
test();
