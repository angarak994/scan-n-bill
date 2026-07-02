import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { business_id, title, discount_percent, end_time } = await request.json();

    if (!business_id) return NextResponse.json({ error: 'Missing business_id' }, { status: 400 });

    // Fetch current pricing rules
    const { data: business } = await supabase.from('businesses').select('pricing_rules').eq('id', business_id).single();
    
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const pricingRules = business.pricing_rules || {};
    
    if (!title && !discount_percent && !end_time) {
      // Clear promotion
      delete pricingRules.activePromotion;
    } else {
      pricingRules.activePromotion = {
        title,
        discount_percent: Number(discount_percent),
        end_time
      };
    }

    const { error: dbError } = await supabase
      .from('businesses')
      .update({ pricing_rules: pricingRules })
      .eq('id', business_id);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const { logActivityToSheet } = require('@/lib/googleSheets');
      await logActivityToSheet('PROMOTION_UPDATED', {
        user: 'Club Owner',
        details: title ? `Launched ${title} (${discount_percent}% off)` : 'Ended active promotion'
      });
    } catch (e) {}

    return NextResponse.json({ success: true, activePromotion: pricingRules.activePromotion });
  } catch (error: any) {
    console.error('Update promotion error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
