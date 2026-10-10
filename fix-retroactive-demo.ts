import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function fix() {
  // Find the latest demo business
  const { data: businesses, error: bErr } = await supabase.from('businesses').select('id, business_name').order('created_at', { ascending: false }).limit(5);
  
  if (bErr || !businesses) {
      console.error(bErr); return;
  }

  for (const b of businesses) {
      const businessId = b.id;
      console.log("Fixing business:", b.business_name, businessId);

      // Check if it already has payments
      const { data: existingPayments } = await supabase.from('payments').select('id').eq('business_id', businessId).limit(1);
      if (existingPayments && existingPayments.length > 0) {
          console.log("Already has payments, skipping.");
          continue;
      }

      // Check for customers
      const { data: customers } = await supabase.from('customers').select('id, name').eq('business_id', businessId);
      if (!customers || customers.length === 0) {
          console.log("No customers found, cannot link payments safely without full re-seed. Will insert generic payments.");
          
          await supabase.from('payments').insert([
              { business_id: businessId, amount: 400, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time (Guest)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
              { business_id: businessId, amount: 200, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Guest)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
              { business_id: businessId, amount: 850, payment_method: 'Card', status: 'Paid', metadata: { description: 'VIP Snooker & Food (Guest)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
              { business_id: businessId, amount: 420, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time & Food (Guest)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
              { business_id: businessId, amount: 500, payment_method: 'UPI', status: 'Paid', metadata: { description: 'QKhata Partial Settlement' }, created_at: new Date().toISOString() },
              { business_id: businessId, amount: 400, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Guest)' }, created_at: new Date().toISOString() }
          ]);
          console.log("Inserted generic payments for", businessId);
          continue;
      }

      const c1 = customers.find(c => c.name === 'Arjun Sharma') || customers[0];
      const c2 = customers.find(c => c.name === 'Priya Patel') || customers[1] || customers[0];
      const c3 = customers.find(c => c.name === 'Rohit Verma') || customers[2] || customers[0];

      const {error: pErr} = await supabase.from('payments').insert([
          { business_id: businessId, customer_id: c2.id, amount: 400, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time (Priya)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
          { business_id: businessId, amount: 200, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Anjali)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
          { business_id: businessId, customer_id: c1.id, amount: 200, payment_method: 'QKhata', status: 'Pending', metadata: { description: 'Table time (Arjun)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
          { business_id: businessId, customer_id: c3.id, amount: 850, payment_method: 'Card', status: 'Paid', metadata: { description: 'VIP Snooker & Food (Rohit)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
          { business_id: businessId, amount: 420, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time & Food (Rahul)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
          { business_id: businessId, customer_id: c1.id, amount: 500, payment_method: 'UPI', status: 'Paid', metadata: { description: 'QKhata Partial Settlement' }, created_at: new Date().toISOString() },
          { business_id: businessId, amount: 400, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Karan)' }, created_at: new Date().toISOString() }
      ]);
      console.log("Inserted structured payments for", businessId, pErr);
  }
}
fix();
