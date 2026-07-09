import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    // Only allow in development or with a secret key in production for safety
    if (process.env.NODE_ENV === 'production' && request.headers.get('x-migrate-key') !== process.env.MIGRATE_SECRET) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: businesses, error } = await supabase.from('businesses').select('id, dashboard_pin');
    if (error) throw error;

    let migratedCount = 0;

    for (const business of businesses) {
      const pinStr = String(business.dashboard_pin);
      // Check if it's already a bcrypt hash (starts with $2a$ or $2b$)
      if (pinStr.startsWith('$2a$') || pinStr.startsWith('$2b$')) {
        continue; // Already hashed
      }

      const hashedPin = await bcrypt.hash(pinStr.trim(), 10);
      await supabase.from('businesses').update({ dashboard_pin: hashedPin }).eq('id', business.id);
      migratedCount++;
    }

    return NextResponse.json({ success: true, migratedCount, message: 'Existing PINs successfully hashed.' });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
