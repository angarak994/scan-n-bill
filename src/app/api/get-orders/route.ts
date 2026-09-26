import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');
    const business_id = searchParams.get('business_id');

    if (!session_id || !business_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Query notifications to reconstruct order history
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('message, created_at, type')
      .eq('business_id', business_id)
      .in('type', ['order_pending', 'order_accepted', 'order_served', 'order_rejected'])
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by session_id embedded in the message
    // Format: itemsJson|orderTotal|session_id
    const orders: any[] = [];
    notifs?.forEach(notif => {
      const parts = notif.message.split('|');
      if (parts.length >= 3 && parts[parts.length - 1] === session_id) {
        try {
          const itemsJson = parts.slice(0, parts.length - 2).join('|');
          const cart = JSON.parse(itemsJson);
          const total = parseFloat(parts[parts.length - 2]);
          orders.push({
            cart,
            total,
            status: notif.type.replace('order_', ''),
            timestamp: notif.created_at
          });
        } catch (e) {
          console.error("Failed to parse order:", e);
        }
      }
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
