import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { parseOrderNotification } from '@/lib/services/foodOrderService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');
    const business_id = searchParams.get('business_id');

    if (!session_id || !business_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Query notifications with database-level session filtering to avoid full table scans
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('id, message, created_at, type')
      .eq('business_id', business_id)
      .like('message', `%|${session_id}`)
      .in('type', ['order_pending', 'order_accepted', 'order_served', 'order_rejected'])
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders: any[] = [];
    notifs?.forEach(notif => {
      const parsed = parseOrderNotification(notif.message);
      if (parsed && parsed.sessionId === session_id) {
        orders.push({
          id: notif.id,
          cart: parsed.rawCart,
          items: parsed.items,
          total: parsed.orderTotal,
          status: notif.type.replace('order_', ''),
          timestamp: notif.created_at
        });
      }
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
