import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Service role client
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const formData = await request.json();

    if (!formData.business_name || !formData.owner_name || !formData.dashboard_pin || !formData.google_sheet_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const hashedPin = await bcrypt.hash(formData.dashboard_pin.toString(), 10);

    // Since this uses the service_role client, it bypasses RLS.
    const { data, error: dbError } = await supabase.from('businesses').insert([{
      business_name: formData.business_name,
      owner_name: formData.owner_name,
      contact_number: formData.contact_number,
      whatsapp_number: formData.whatsapp_number || null,
      dashboard_pin: hashedPin,
      google_sheet_id: formData.google_sheet_id,
      status: 'ACTIVE',
      tables: [] // Start with empty tables
    }]).select().single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    await setSession(data.id, 'owner');

    return NextResponse.json({ success: true, businessId: data.id });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during registration.' }, { status: 500 });
  }
}
