import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_id, goals } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (!business_id || !goals) {
      return NextResponse.json({ error: 'Business ID and goals object are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update({ goals })
      .eq('id', business_id);

    if (error) throw error;

    return NextResponse.json({ success: true, goals });
  } catch (error: any) {
    console.error('Update Goals Error:', error);
    return NextResponse.json({ error: 'Failed to update business goals' }, { status: 500 });
  }
}
