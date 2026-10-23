import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { businessManager } from '@/lib/businessManager';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';
import { parseOrderNotification } from '@/lib/services/foodOrderService';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramAlert(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Failed to send telegram cancellation alert:', e);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    if (!checkRateLimit(`del_order_${ip}`, 40, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Business owner login required' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;
    let targetBusinessId = body.businessId || sessionCookie.businessId;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing required field: orderId' }, { status: 400 });
    }

    // Strict multi-tenant authorization validation
    if (sessionCookie.businessId !== targetBusinessId) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }
    const businessId = sessionCookie.businessId;

    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Lookup the order notification ensuring tenant ownership
    const { data: order, error: orderErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', orderId)
      .eq('business_id', businessId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Food order not found or does not belong to this business' }, { status: 404 });
    }

    // Guard against duplicate deletion requests
    if (order.type === 'order_cancelled' || order.type === 'order_voided') {
      return NextResponse.json({ error: 'This food order has already been deleted or cancelled' }, { status: 400 });
    }

    // Parse notification message structure reliably
    const parsedOrder = parseOrderNotification(order.message);
    const sessionId = parsedOrder?.sessionId || null;
    const orderTotal = parsedOrder?.orderTotal || 0;

    let newFoodCost: number | null = null;
    let associatedSession = null;

    if (sessionId) {
      associatedSession = await sessionRepository.findById(sessionId, businessId);

      if (associatedSession) {
        if (associatedSession.status === 'ACTIVE') {
          // ACTIVE SESSION: Decrement running food_cost atomically
          const currentFoodCost = typeof associatedSession.food_cost === 'number' ? associatedSession.food_cost : 0;
          newFoodCost = Math.max(0, currentFoodCost - orderTotal);

          const { error: updateErr } = await supabase
            .from('sessions')
            .update({ food_cost: newFoodCost })
            .eq('id', sessionId)
            .eq('business_id', businessId);

          if (updateErr) {
            console.error('[delete-food-order] Failed to update session food_cost:', updateErr);
            return NextResponse.json({ error: 'Failed to update table session food cost' }, { status: 500 });
          }

          // Mark notification as cancelled
          const { error: notifErr } = await supabase
            .from('notifications')
            .update({ 
              type: 'order_cancelled', 
              is_read: true 
            })
            .eq('id', orderId)
            .eq('business_id', businessId);

          if (notifErr) {
            console.error('[delete-food-order] Failed to cancel order notification:', notifErr);
          }

          // Enqueue Google Sheets sync
          try {
            const { enqueueSheetsSync } = require('@/lib/sheetsSyncQueue');
            enqueueSheetsSync('SESSION', sessionId, businessId);
          } catch (syncErr) {
            console.error('[delete-food-order] Google Sheets Sync Queue Error:', syncErr);
          }
        } else if (associatedSession.status === 'COMPLETED') {
          // COMPLETED SESSION: Preserve financial integrity with void / reversal workflow
          const currentFoodCost = typeof associatedSession.food_cost === 'number' ? associatedSession.food_cost : 0;
          newFoodCost = Math.max(0, currentFoodCost - orderTotal);
          const currentCost = typeof associatedSession.cost === 'number' ? associatedSession.cost : 0;
          const newCost = Math.max(0, currentCost - orderTotal);

          // Mark order notification as voided
          await supabase
            .from('notifications')
            .update({ 
              type: 'order_voided', 
              is_read: true 
            })
            .eq('id', orderId)
            .eq('business_id', businessId);

          const customerId = (associatedSession as any).customer_id || (associatedSession as any).member_id;

          if (associatedSession.payment_status === 'Pending' || associatedSession.payment_method === 'QKhata') {
            // Unpaid ledger charge: reverse customer ledger
            if (customerId) {
              await supabase.rpc('increment_customer_ledger', {
                p_customer_id: customerId,
                p_billed: -orderTotal,
                p_paid: 0
              });
            }

            await supabase.from('payments').insert([{
              business_id: businessId,
              customer_id: customerId || null,
              session_id: sessionId,
              amount: orderTotal,
              payment_method: 'QKhata',
              status: 'Voided',
              metadata: {
                type: 'CHARGE_VOID_REVERSAL',
                reason: 'Food order voided after session completion',
                order_id: orderId,
                order_title: order.title
              }
            }]);
          } else {
            // Paid session: record reversal entry in payments table to preserve accounting records
            const { data: existingPay } = await supabase
              .from('payments')
              .select('payment_method')
              .eq('session_id', sessionId)
              .limit(1)
              .maybeSingle();

            await supabase.from('payments').insert([{
              business_id: businessId,
              customer_id: customerId || null,
              session_id: sessionId,
              amount: orderTotal,
              payment_method: existingPay?.payment_method || 'Cash',
              status: 'Refunded',
              metadata: {
                type: 'ORDER_VOID_REVERSAL',
                reason: 'Food order voided after session completion',
                order_id: orderId,
                order_title: order.title
              }
            }]);
          }

          // Update completed session totals
          await supabase
            .from('sessions')
            .update({ 
              food_cost: newFoodCost, 
              cost: newCost 
            })
            .eq('id', sessionId)
            .eq('business_id', businessId);

          // Enqueue Google Sheets sync
          try {
            const { enqueueSheetsSync } = require('@/lib/sheetsSyncQueue');
            enqueueSheetsSync('SESSION', sessionId, businessId);
            if (customerId) {
              enqueueSheetsSync('MEMBER', customerId, businessId);
            }
          } catch (syncErr) {
            console.error('[delete-food-order] Google Sheets Sync Queue Error:', syncErr);
          }
        }
      } else {
        // Associated session not found in DB
        await supabase
          .from('notifications')
          .update({ type: 'order_cancelled', is_read: true })
          .eq('id', orderId)
          .eq('business_id', businessId);
      }
    } else {
      // Standalone order notification without session_id
      await supabase
        .from('notifications')
        .update({ type: 'order_cancelled', is_read: true })
        .eq('id', orderId)
        .eq('business_id', businessId);
    }

    // Notify Telegram authorized owners if configured
    if (TELEGRAM_BOT_TOKEN) {
      try {
        const gs = business.pricing_rules?.globalSettings as any;
        if (gs && Array.isArray(gs.authorized_telegram_owners)) {
          const tableName = associatedSession?.table_id || 'Table';
          const alertMsg = `🗑️ <b>Food Order Deleted</b>\n\n<b>Table:</b> ${tableName}\n<b>Order:</b> ${order.title}\n<b>Deducted Total:</b> ₹${orderTotal}\n<b>Status:</b> Cancelled`;
          for (const owner of gs.authorized_telegram_owners) {
            if (owner.status !== 'revoked' && owner.chatId) {
              sendTelegramAlert(owner.chatId, alertMsg).catch(() => {});
            }
          }
        }
      } catch (tgError) {
        console.error('[delete-food-order] Telegram notify error:', tgError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Food order successfully deleted',
      orderId,
      orderTotal,
      sessionId,
      newFoodCost
    }, { status: 200 });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[delete-food-order] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
