import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, authKey, senderId, provider } = body;

    let sms_config = null;

    if (action === 'connect') {
      if (!authKey || !senderId) {
        return NextResponse.json({ error: 'Auth Key and Sender ID are required' }, { status: 400 });
      }
      sms_config = {
        enabled: true,
        provider: provider || 'msg91',
        authKey,
        senderId
      };
    } else if (action === 'disconnect') {
      sms_config = {
        enabled: false,
        provider: 'msg91',
        authKey: null,
        senderId: null
      };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update({ sms_config })
      .eq('id', sessionCookie.businessId);

    if (error) {
      console.error('Update SMS Config Error:', error);
      return NextResponse.json({ error: 'Failed to update SMS configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled: sms_config.enabled });
  } catch (error: any) {
    console.error('Update SMS Config API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
