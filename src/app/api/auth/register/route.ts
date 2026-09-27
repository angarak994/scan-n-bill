import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Service role client
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { initializeGoogleSheet } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const formData = await request.json();

    if (!formData.business_name || !formData.owner_name || !formData.dashboard_pin || !formData.google_sheet_id || !formData.contact_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^\d{10}$/.test(formData.contact_number)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    // Extract ID if user pasted full URL
    let finalSheetId = formData.google_sheet_id.trim();
    if (finalSheetId.includes('/d/')) {
      const match = finalSheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalSheetId = match[1];
      }
    }

    try {
      await initializeGoogleSheet(finalSheetId);
    } catch (e) {
      console.error('Failed to initialize Google Sheet tabs:', e);
      return NextResponse.json({ error: 'Failed to initialize Google Sheet. Ensure the Service Account is an Editor.' }, { status: 400 });
    }

    const hashedPin = await bcrypt.hash(formData.dashboard_pin.toString(), 10);

    // Since this uses the service_role client, it bypasses RLS.
    const { data, error: dbError } = await supabase.from('businesses').insert([{
      business_name: formData.business_name,
      owner_name: formData.owner_name,
      contact_number: formData.contact_number,
      whatsapp_number: formData.whatsapp_number || null,
      dashboard_pin: hashedPin,
      google_sheet_id: finalSheetId,
      status: 'ACTIVE',
      tables: [] // Start with empty tables
    }]).select().single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Assign a 14-day free trial of the Growth plan by default
    const { data: growthPlan } = await supabase.from('subscription_plans').select('id').eq('name', 'Growth').single();
    if (growthPlan) {
       await supabase.from('business_subscriptions').insert([{
          business_id: data.id,
          plan_id: growthPlan.id,
          status: 'trialing',
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
       }]);
    }

    await setSession(data.id, 'owner');

    return NextResponse.json({ success: true, businessId: data.id });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during registration.' }, { status: 500 });
  }
}
