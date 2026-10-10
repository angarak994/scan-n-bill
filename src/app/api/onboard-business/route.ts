import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import QRCode from 'qrcode';
import { businessManager } from '@/lib/businessManager';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { initializeGoogleSheet } from '@/lib/googleSheets';
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { business_name, owner_name, contact_number, address, google_sheet_id, business_type, pricing_rules, tables, dashboard_pin, menu_items, is_demo } = data;

    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(contact_number);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Contact number must be exactly 10 digits' }, { status: 400 });
    }

    // --- IDEMPOTENT DEMO BUSINESS LOGIC ---
    if (is_demo) {
        const { data: existingDemos } = await supabase
            .from('businesses')
            .select('id, business_name, tables')
            .eq('business_name', 'Strike Zone (Demo)')
            .order('created_at', { ascending: true })
            .limit(1);

        if (existingDemos && existingDemos.length > 0) {
            const demoBiz = existingDemos[0];
            const businessId = demoBiz.id;

            await setSession(businessId, 'owner');
            
            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            const businessSlug = demoBiz.business_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            const qrs = await Promise.all((demoBiz.tables || []).map(async (t: any) => {
              const tableId = t.id || t.table_id;
              const url = `${origin}/qr/${businessSlug}/${encodeURIComponent(tableId)}`;
              const dataUrl = await QRCode.toDataURL(url);
              return { name: t.name, dataUrl };
            }));

            const dashboardUrl = `${origin}/dashboard`;
            const dashboardQr = await QRCode.toDataURL(dashboardUrl);
            qrs.push({ name: 'Owner Dashboard', dataUrl: dashboardQr });

            // Hardcode 1234 as it's the standard demo pin, since DB only has hashed version
            return NextResponse.json({ success: true, businessId, qrs, pin: '1234' }, { status: 200 });
        }
    }
    // ----------------------------------------

    let finalSheetId = google_sheet_id.trim();
    if (finalSheetId.includes('/d/')) {
      const match = finalSheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalSheetId = match[1];
      }
    }

    try {
      await initializeGoogleSheet(finalSheetId);
    } catch (err: any) {
      console.warn("Google Sheets API Initialization Warning (Non-Fatal):", err?.message || err);
    }

    const hashedPin = await bcrypt.hash(dashboard_pin.toString(), 10);
    const dynamicTables = (tables && tables.length > 0) ? tables : [
      { name: 'Table 1', id: 'Table 1', type: 'general' }
    ];

    const businessId = await businessManager.registerBusiness({
      business_name,
      owner_name,
      contact_number: normalizedPhone,
      address,
      google_sheet_id: finalSheetId,
      business_type,
      pricing_rules,
      tables: dynamicTables,
      dashboard_pin: hashedPin,
      menu_items,
      created_at: new Date().toISOString()
    });

    const { data: growthPlan } = await supabase.from('subscription_plans').select('id').eq('name', 'Growth').single();
    if (growthPlan) {
       await supabase.from('business_subscriptions').insert([{
          business_id: businessId,
          plan_id: growthPlan.id,
          status: 'trialing',
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
       }]);
    }

    await setSession(businessId, 'owner');

    const origin = request.headers.get('origin') || 'https://billiards-qr-sessions.vercel.app';
    const businessSlug = business_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (is_demo) {
      try {
        // 1. Memberships
        const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
        const { data: m1 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Arjun Sharma', mobile: '9876543210', tier: 'Gold', expiry_date: expiry }).select('id').single();
        const { data: m2 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Priya Patel', mobile: '9123456789', tier: 'Standard', expiry_date: expiry }).select('id').single();
        const { data: m3 } = await supabase.from('memberships').insert({ business_id: businessId, name: 'Rohit Verma', mobile: '9001122334', tier: 'Platinum', expiry_date: expiry }).select('id').single();
        
        // 2. Customers (for QKhata / Payments)
        const { data: c1 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Arjun Sharma', phone: '9876543210', outstanding_balance: 1450 }).select('id').single();
        const { data: c2 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Priya Patel', phone: '9123456789', outstanding_balance: 0 }).select('id').single();
        const { data: c3 } = await supabase.from('customers').insert({ business_id: businessId, name: 'Rohit Verma', phone: '9001122334', outstanding_balance: -200 }).select('id').single();
        
        if (m1 && m2 && c1 && c2 && c3 && m3) {
            const todayDate = new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const twoDaysAgoDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

            // 3. Completed Sessions (Revenue Data across multiple days)
            await supabase.from('sessions').insert([
              { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Priya Patel', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m2.id },
              { business_id: businessId, date: twoDaysAgoDate, customer_name: 'Anjali Desai (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 2*86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 2*86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
              { business_id: businessId, date: yesterdayDate, customer_name: 'Arjun Sharma', table_id: 'T1', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), end_time: new Date(Date.now() - 86400000).toISOString(), duration: '1h 0m', cost: 200, base_cost: 200, food_cost: 0, status: 'COMPLETED', payment_status: 'Pending', completed_by: 'Demo System', member_id: m1.id },
              { business_id: businessId, date: yesterdayDate, customer_name: 'Rohit Verma', table_id: 'VIP1', game_type: 'snooker', start_time: new Date(Date.now() - 86400000 - 10800000).toISOString(), end_time: new Date(Date.now() - 86400000 - 3600000).toISOString(), duration: '2h 0m', cost: 850, base_cost: 600, food_cost: 250, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System', member_id: m3.id },
              { business_id: businessId, date: yesterdayDate, customer_name: 'Rahul Kumar (Guest)', table_id: 'T2', game_type: 'pool', start_time: new Date(Date.now() - 86400000 - 7200000).toISOString(), end_time: new Date(Date.now() - 86400000 - 1800000).toISOString(), duration: '1h 30m', cost: 420, base_cost: 300, food_cost: 120, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo System' },
              { business_id: businessId, date: todayDate, customer_name: 'Karan Singh (Guest)', table_id: 'T4', game_type: 'pool', start_time: new Date(Date.now() - 14400000).toISOString(), end_time: new Date(Date.now() - 7200000).toISOString(), duration: '2h 0m', cost: 400, base_cost: 400, food_cost: 0, status: 'COMPLETED', payment_status: 'Paid', completed_by: 'Demo Admin' }
            ]);
            
            // 4. Active Sessions (Dashboard)
            await supabase.from('sessions').insert([
              { business_id: businessId, date: todayDate, customer_name: 'Priya Patel', table_id: 'T3', game_type: 'pool', start_time: new Date(Date.now() - 1800000).toISOString(), status: 'ACTIVE', member_id: m2.id },
              { business_id: businessId, date: todayDate, customer_name: 'Guest 101', table_id: 'T5', game_type: 'snooker', start_time: new Date(Date.now() - 5400000).toISOString(), status: 'ACTIVE' }
            ]);

            // 5. Bookings
            const futureTime1 = new Date(Date.now() + 3600000).toTimeString().substring(0, 5); // 1 hour from now
            const futureTime2 = new Date(Date.now() + 10800000).toTimeString().substring(0, 5); // 3 hours from now
            await supabase.from('bookings').insert([
              { business_id: businessId, customer_name: 'Arjun Sharma', customer_phone: '9876543210', table_id: 'T1', booking_date: todayDate, start_time: futureTime1, duration_minutes: 120, status: 'confirmed', source: 'whatsapp', game_type: 'pool' },
              { business_id: businessId, customer_name: 'Vikram Mehta', customer_phone: '9988112233', table_id: 'VIP1', booking_date: todayDate, start_time: futureTime2, duration_minutes: 60, status: 'confirmed', source: 'manual', game_type: 'snooker' }
            ]);

            // 6. Promotions
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
            
            // 7. Payments (Transactions History)
            await supabase.from('payments').insert([
              { business_id: businessId, customer_id: c2.id, amount: 400, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time (Priya)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
              { business_id: businessId, amount: 200, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Anjali)' }, created_at: new Date(Date.now() - 2*86400000).toISOString() },
              { business_id: businessId, customer_id: c1.id, amount: 200, payment_method: 'QKhata', status: 'Pending', metadata: { description: 'Table time (Arjun)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
              { business_id: businessId, customer_id: c3.id, amount: 850, payment_method: 'Card', status: 'Paid', metadata: { description: 'VIP Snooker & Food (Rohit)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
              { business_id: businessId, amount: 420, payment_method: 'UPI', status: 'Paid', metadata: { description: 'Table time & Food (Rahul)' }, created_at: new Date(Date.now() - 86400000).toISOString() },
              { business_id: businessId, customer_id: c1.id, amount: 500, payment_method: 'UPI', status: 'Paid', metadata: { description: 'QKhata Partial Settlement' }, created_at: new Date(Date.now() - 43200000).toISOString() },
              { business_id: businessId, amount: 400, payment_method: 'Cash', status: 'Paid', metadata: { description: 'Table time (Karan)' }, created_at: new Date(Date.now() - 7200000).toISOString() }
            ]);
        }
      } catch(demoErr) {
        console.error("Failed to seed demo data", demoErr);
      }
    }

    const qrs = await Promise.all(dynamicTables.map(async (t: any) => {
      const tableId = t.id || t.table_id;
      const url = `${origin}/qr/${businessSlug}/${encodeURIComponent(tableId)}`;
      const dataUrl = await QRCode.toDataURL(url);
      return {
        name: t.name,
        dataUrl,
      };
    }));

    const dashboardUrl = `${origin}/dashboard`;
    const dashboardQr = await QRCode.toDataURL(dashboardUrl);
    qrs.push({ name: 'Owner Dashboard', dataUrl: dashboardQr });

    return NextResponse.json({ success: true, businessId, qrs, pin: dashboard_pin }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
