import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { business_id, pricing_rules, tables } = body;

    if (!business_id) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (pricing_rules !== undefined) updatePayload.pricing_rules = pricing_rules;
    if (tables !== undefined) updatePayload.tables = tables;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update(updatePayload)
      .eq('id', business_id);

    if (error) {
      console.error('Error updating business config in Supabase:', error);
      throw error;
    }

    return NextResponse.json({ success: true, pricing_rules, tables });
  } catch (error: any) {
    console.error('Update Business Config Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update business configuration' }, { status: 500 });
  }
}
