import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get('game_type');
    
    // Fetch all active verified businesses
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, business_name, address, tables, pricing_rules, status')
      .eq('status', 'ACTIVE');
    
    if (error) throw error;
    
    // Filter out archived businesses
    let results = (businesses || []).filter(
      (b: any) => !b.business_name?.toLowerCase().includes('archived')
    );

    // Filter businesses that support the game type if provided
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
      name: b.business_name,
      location: b.address,
      tables: (b.tables || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type })),
      available_games: Object.keys(b.pricing_rules?.rules || {})
    }));

    return NextResponse.json({ businesses: publicBusinesses }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
