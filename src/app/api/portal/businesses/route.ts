import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get('game_type');
    
    // Fetch all active businesses
    let query = supabase.from('businesses').select('id, name, location, tables, pricing_rules');
    
    const { data: businesses, error } = await query;
    if (error) throw error;
    
    // Filter businesses that support the game type if provided
    let results = businesses || [];
    if (gameType) {
        results = results.filter((b: any) => {
            const hasTable = (b.tables || []).some((t: any) => t.type?.toLowerCase() === gameType.toLowerCase());
            const hasPricing = b.pricing_rules?.rules?.[gameType.toLowerCase()] !== undefined;
            return hasTable || hasPricing;
        });
    }

    // Strip out sensitive config data for public portal viewing
    const publicBusinesses = results.map((b: any) => ({
        id: b.id,
        name: b.name,
        location: b.location,
        tables: (b.tables || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type })),
        available_games: Object.keys(b.pricing_rules?.rules || {})
    }));

    return NextResponse.json({ businesses: publicBusinesses }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
