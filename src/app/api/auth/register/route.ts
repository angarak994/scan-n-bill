import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Service role client

export async function POST(request: Request) {
  try {
    const formData = await request.json();

    if (!formData.business_name || !formData.owner_name || !formData.dashboard_pin || !formData.google_sheet_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Since this uses the service_role client, it bypasses RLS.
    const { data, error: dbError } = await supabase.from('businesses').insert([{
      business_name: formData.business_name,
      owner_name: formData.owner_name,
      contact_number: formData.contact_number,
      whatsapp_number: formData.whatsapp_number || null,
      dashboard_pin: formData.dashboard_pin,
      google_sheet_id: formData.google_sheet_id,
      status: 'ACTIVE',
      tables: [] // Start with empty tables
    }]).select().single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, businessId: data.id, pin: data.dashboard_pin });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during registration.' }, { status: 500 });
  }
}
