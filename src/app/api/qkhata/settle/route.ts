import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const sessionCookie = await getSession();
        if (!sessionCookie || !sessionCookie.businessId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { customerId, amount, settlementMethod, selectedCustomerName, selectedCustomerPhone, isCustomerRecord, idempotencyKey } = body;
        const businessId = sessionCookie.businessId;

        if (!amount || Number(amount) <= 0 || !settlementMethod) {
            return NextResponse.json({ error: 'Valid settlement amount and payment method are required' }, { status: 400 });
        }

        let customerIdToUse = customerId;

        // Fetch all customers & memberships to identify any sibling records for this member/customer
        const [customersRes, membershipsRes] = await Promise.all([
            supabase.from('customers').select('*').eq('business_id', businessId),
            supabase.from('memberships').select('*').eq('business_id', businessId)
        ]);

        const allCustomers = customersRes.data || [];
        const allMemberships = membershipsRes.data || [];

        const searchPhone = selectedCustomerPhone ? selectedCustomerPhone.trim() : null;
        const searchName = selectedCustomerName ? selectedCustomerName.trim().toLowerCase() : null;
        const targetMem = allMemberships.find((m: any) => 
            (customerIdToUse && m.id === customerIdToUse) ||
            (searchPhone && m.mobile && m.mobile.trim() === searchPhone) ||
            (searchName && m.name && m.name.trim().toLowerCase() === searchName)
        );

        // Find all sibling customer records across ID, phone, and name
        const siblingRows = allCustomers.filter((c: any) => {
            if (customerIdToUse && c.id === customerIdToUse) return true;
            if (targetMem) {
                if (c.id === targetMem.id) return true;
                if (targetMem.mobile && c.phone && targetMem.mobile.trim() === c.phone.trim()) return true;
                if (targetMem.name && c.name && targetMem.name.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
            }
            if (searchPhone && c.phone && c.phone.trim() === searchPhone) return true;
            if (searchName && c.name && c.name.trim().toLowerCase() === searchName) return true;
            return false;
        });

        let primaryCustomer = (targetMem && siblingRows.find((c: any) => c.id === targetMem.id)) ||
                              siblingRows.find((c: any) => c.phone) || 
                              siblingRows[0];

        if (!primaryCustomer) {
            // Auto-create ledger profile if not found
            const { data: newCust, error: createErr } = await supabase.from('customers').insert([{
                business_id: businessId,
                name: (targetMem?.name || selectedCustomerName || 'Member').trim(),
                phone: targetMem?.mobile || selectedCustomerPhone || null,
                total_billed: 0,
                total_paid: 0,
                outstanding_balance: 0
            }]).select().single();
            if (createErr) throw createErr;
            primaryCustomer = newCust;
            siblingRows.push(newCust);
        }

        const customerIdToRecord = primaryCustomer.id;

        // --- IDEMPOTENCY GUARD ---
        // Prevent accidental double-clicks or retried settlement requests
        const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
        const { data: recentDuplicate } = await supabase
            .from('payments')
            .select('id, created_at, metadata')
            .eq('business_id', businessId)
            .eq('customer_id', customerIdToRecord)
            .eq('amount', Number(amount))
            .gte('created_at', fiveSecondsAgo)
            .limit(1);

        if (recentDuplicate && recentDuplicate.length > 0) {
            console.warn(`[settle] Idempotent duplicate settlement blocked for customer ${customerIdToRecord} (amount: ${amount})`);
            return NextResponse.json({ ok: true, customerId: customerIdToRecord, duplicatePrevented: true });
        }

        const currentTotalBalance = siblingRows.reduce((acc: number, c: any) => acc + (Number(c.outstanding_balance) || 0), 0);
        const newOutstanding = currentTotalBalance - Number(amount);

        // Create payment record
        const paymentRecord = {
            business_id: businessId,
            customer_id: customerIdToRecord,
            amount: Number(amount),
            payment_method: settlementMethod,
            status: 'Paid',
            metadata: {
                type: 'PAYMENT',
                source: 'Dashboard Settlement',
                idempotency_key: idempotencyKey || null,
                description: `QKhata Settlement (${settlementMethod})`
            }
        };

        const { error: paymentError } = await supabase.from('payments').insert([paymentRecord]);
        if (paymentError) throw paymentError;

        // Consolidate balances across all sibling records:
        // Set all other sibling rows to 0
        const otherSiblingIds = siblingRows.filter((c: any) => c.id !== primaryCustomer.id).map((c: any) => c.id);
        if (otherSiblingIds.length > 0) {
            await supabase.from('customers').update({ outstanding_balance: 0 }).in('id', otherSiblingIds);
        }

        const newTotalPaid = Number(primaryCustomer.total_paid || 0) + Number(amount);
        const { error: customerError } = await supabase.from('customers').update({
            total_paid: newTotalPaid,
            outstanding_balance: newOutstanding,
            updated_at: new Date().toISOString()
        }).eq('id', primaryCustomer.id);

        if (customerError) throw customerError;

        // Sync member ledger update to Google Sheets (Non-blocking)
        Promise.resolve().then(async () => {
            try {
                const { enqueueSheetsSync } = require('@/lib/sheetsSyncQueue');
                enqueueSheetsSync('MEMBER', customerIdToRecord, businessId);
            } catch (err) {
                console.warn('[settle] Non-fatal sheets sync error:', err);
            }
        }).catch(console.error);

        // --- Telegram Notification ---
        try {
            const { data: business } = await supabase.from('businesses').select('pricing_rules').eq('id', businessId).single();
            const owners = business?.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
            
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken && owners.length > 0) {
                const displayName = (targetMem?.name || selectedCustomerName || primaryCustomer.name || 'Member').trim();
                const remainingDisplay = Math.max(0, Math.round(newOutstanding));
                const overpaidStr = newOutstanding < 0 ? ` (Overpaid: ₹${Math.abs(Math.round(newOutstanding))})` : '';
                const msg = `✅ <b>Payment Recorded</b>\n\nCollected: ₹${amount}\nFrom: ${displayName}\nRemaining Balance: ₹${remainingDisplay}${overpaidStr}`;
                
                for (const owner of owners) {
                    if (owner.status !== 'revoked' && owner.chatId) {
                        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: owner.chatId,
                                text: msg,
                                parse_mode: 'HTML'
                            })
                        }).catch(e => console.error('Telegram notification error:', e));
                    }
                }
            }
        } catch (tgErr) {
            console.error('Failed to send telegram notification for settlement:', tgErr);
        }
        // -----------------------------

        return NextResponse.json({ ok: true, customerId: customerIdToRecord });
    } catch (error: any) {
        console.error('Settlement Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
