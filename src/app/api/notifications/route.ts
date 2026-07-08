import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('b');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error: any) {
    console.error('Notifications Error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, notification_id, business_id } = body;

    if (!business_id) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });

    if (action === 'mark_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq(notification_id ? 'id' : 'business_id', notification_id || business_id)
        .eq('business_id', business_id);
      
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    
    if (action === 'clear_all') {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('business_id', business_id);
        
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Notifications Update Error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
