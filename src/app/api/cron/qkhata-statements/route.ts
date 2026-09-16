import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function GET(req: Request) {
    try {
        // Simple auth for Vercel Cron
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all businesses
        const { data: businesses, error: bizErr } = await supabase.from('businesses').select('id, business_name');
        if (bizErr) throw bizErr;

        let sentCount = 0;

        // Iterate businesses
        for (const business of businesses) {
            // Fetch customers with outstanding > 0
            const { data: customers, error: custErr } = await supabase
                .from('customers')
                .select('id, name, phone, outstanding_balance')
                .eq('business_id', business.id)
                .gt('outstanding_balance', 0);

            if (custErr || !customers) continue;

            for (const customer of customers) {
                if (!customer.phone) continue;

                // Clean phone number
                let cleanPhone = customer.phone.replace(/\D/g, '');
                if (cleanPhone.length === 10) {
                    cleanPhone = `91${cleanPhone}`;
                }

                const amount = Number(customer.outstanding_balance).toFixed(2);
                const message = `📒 *${business.business_name} QKhata Statement*\n\nHi ${customer.name},\nThis is a friendly automated reminder that you have an outstanding QKhata balance of *₹${amount}*.\n\nPlease settle this at your earliest convenience. See you soon!`;

                try {
                    await sendWhatsAppText(cleanPhone, message);
                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send to ${customer.phone}:`, err);
                }
            }
        }

        return NextResponse.json({ ok: true, sentCount });
    } catch (error: any) {
        console.error('QKhata Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
