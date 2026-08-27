import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    
    // Secure backend validation via JWT
    if (!sessionCookie || !sessionCookie.businessId) {
       return NextResponse.json({ error: 'Unauthorized: Invalid or missing session cookie' }, { status: 401 });
    }
    
    const businessId = sessionCookie.businessId;

    // Update the business record to mark has_logged_in as true
    const { error } = await supabase
      .from('businesses')
      .update({ has_logged_in: true })
      .eq('id', businessId);

    if (error) {
      console.error('Failed to update has_logged_in:', error);
      return NextResponse.json({ error: 'Failed to update login status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mark Logged In Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
