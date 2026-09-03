import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { generateQpulseInsight } from '@/lib/services/qpulseService';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.businessId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const businessId = session.businessId;

        // Fetch config
        const { data: business } = await supabase
            .from('businesses')
            .select('qpulse_config')
            .eq('id', businessId)
            .single();

        if (!business) {
            return NextResponse.json({ show: false });
        }

        const config = business.qpulse_config as any || { frequency: 'Every 3 days', last_shown_date: null };
        if (config.enabled === false || config.frequency === 'Off') {
            return NextResponse.json({ show: false });
        }

        const lastShown = config.last_shown_date ? new Date(config.last_shown_date) : null;
        const now = new Date();

        if (lastShown) {
            const diffTime = Math.abs(now.getTime() - lastShown.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (config.frequency === 'Once a day' && diffDays < 1) return NextResponse.json({ show: false });
            if (config.frequency === 'Every 3 days' && diffDays < 3) return NextResponse.json({ show: false });
            if (config.frequency === 'Weekly' && diffDays < 7) return NextResponse.json({ show: false });
        }

        const insightObj = await generateQpulseInsight(businessId);
        
        if (!insightObj) {
            return NextResponse.json({ show: false });
        }

        return NextResponse.json({
            show: true,
            insight: insightObj.dashboard
        });

    } catch (err: any) {
        console.error('Qpulse Error:', err);
        return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.businessId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const businessId = session.businessId;
        
        // Fetch current config
        const { data: business } = await supabase
            .from('businesses')
            .select('qpulse_config')
            .eq('id', businessId)
            .single();
            
        const config = (business?.qpulse_config as any) || { frequency: 'Every 3 days' };
        config.last_shown_date = new Date().toISOString();

        await supabase.from('businesses').update({ qpulse_config: config }).eq('id', businessId);
        
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    }
}
