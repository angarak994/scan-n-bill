import { normalizePhone } from '@/lib/utils/phoneValidation';
import { v4 as uuid } from 'uuid';
import { sessionRepository, Session } from './repositories/sessionRepository';
import { GameType } from './pricing';
import { calculateBilling, getCurrentISTDateStr } from './billing';
import { businessManager } from './businessManager';
import { supabase } from './supabaseClient';
import { resolveRate } from './pricing';

// Use ISO strings for robust time storage
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

interface PromoCacheEntry {
  promo: any;
  expiresAt: number;
}
const promoCache = new Map<string, PromoCacheEntry>();
const PROMO_CACHE_TTL_MS = 60000; // 1 minute

async function getCachedActivePromos(businessId: string) {
  const now = Date.now();
  const cached = promoCache.get(businessId);
  if (cached && cached.expiresAt > now) {
    return cached.promo;
  }
  const { data: promos } = await supabase
    .from('promotions')
    .select('id, name, description, promo_type, fixed_price, fixed_amount_discount, discount_percent, applicable_game_types, applicable_tables, start_time, end_time, time_slot_start, time_slot_end, status')
    .eq('business_id', businessId)
    .in('status', ['Active', 'Scheduled']); // Fetch both in case status hasn't synced yet
    
  if (promos && promos.length > 0) {
    const { parseDateString } = require('./billing');
    const validPromos = promos.filter(p => {
      const eTime = parseDateString(p.end_time);
      return eTime > now && p.status !== 'Paused' && p.status !== 'Cancelled';
    });
    
    promoCache.set(businessId, { promo: validPromos, expiresAt: now + PROMO_CACHE_TTL_MS });
    return validPromos;
  }
  
  promoCache.set(businessId, { promo: [], expiresAt: now + PROMO_CACHE_TTL_MS });
  return [];
}

const membershipsCache = new Map<string, { data: any[], expiresAt: number }>();
async function getCachedMemberships(businessId: string) {
  const now = Date.now();
  const cached = membershipsCache.get(businessId);
  if (cached && cached.expiresAt > now) return cached.data;
  const { data } = await supabase.from('memberships').select('*').eq('business_id', businessId);
  const result = data || [];
  membershipsCache.set(businessId, { data: result, expiresAt: now + 60000 });
  return result;
}

const customersCache = new Map<string, { data: any[], expiresAt: number }>();
async function getCachedCustomers(businessId: string) {
  const now = Date.now();
  const cached = customersCache.get(businessId);
  if (cached && cached.expiresAt > now) return cached.data;
  const { data } = await supabase.from('customers').select('id, name, phone').eq('business_id', businessId).limit(5000);
  const result = data || [];
  customersCache.set(businessId, { data: result, expiresAt: now + 60000 });
  return result;
}


export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// In-memory locks to prevent race conditions during rapid simultaneous requests
const activeTableLocks = new Set<string>();

export async function startSession(table_id: string, game_type: GameType, customer_name: string, businessId?: string, num_players: number = 1, member_id?: string, custom_start_time?: string, notes?: string) {
  const lockKey = `${businessId || 'global'}_${table_id}`;
  if (activeTableLocks.has(lockKey)) {
    throw new ApiError(409, 'Action in progress, please wait.');
  }
  
  try {
    activeTableLocks.add(lockKey);
    
    if (!customer_name || customer_name.trim() === '') {
      throw new ApiError(400, 'Customer Name is mandatory');
    }

    const now = custom_start_time ? new Date(custom_start_time) : new Date();
    
    // Fetch dependencies concurrently
    let existingSession = null;
    let business = null;
    let pricingRulesRes = null;

    if (businessId) {
      [existingSession, business, pricingRulesRes] = await Promise.all([
        sessionRepository.findActiveByTable(table_id, businessId),
        businessManager.getBusiness(businessId),
        supabase.from('pricing_rules').select('*').eq('business_id', businessId)
      ]);
    } else {
      existingSession = await sessionRepository.findActiveByTable(table_id, undefined);
    }

    if (existingSession) {
      throw new ApiError(400, 'A session is already active for this table');
    }

    // Force game type from configuration mapping
    if (businessId && business) {
      const tableConfig = business.tables?.find(t => t.id.toLowerCase().trim() === String(table_id).toLowerCase().trim());
      if (!tableConfig) {
        throw new ApiError(403, 'Invalid table or business mapping.');
      }
      if ((tableConfig as any).game_type) {
        game_type = (tableConfig as any).game_type as GameType;
      }
    }

    if (game_type === 'ps5' && (num_players < 1 || num_players > 4)) {
      throw new ApiError(400, 'PS5 sessions must have between 1 and 4 players.');
    }

    // Resolve rate
    let lockedRate = undefined;
    let lockedRateName = undefined;
    if (businessId && pricingRulesRes?.data) {
      const activeRule = resolveRate(game_type, pricingRulesRes.data, now);
      if (activeRule) {
        lockedRate = activeRule.rate_per_hour;
        lockedRateName = activeRule.rule_type;
      }
    }

  const dateStr = getCurrentISTDateStr(now.getTime()); // IST Date
  const timeStr = now.toISOString(); // Full ISO timestamp
  
  const session: Session = {
    id: uuid(),
    date: dateStr,
    customer_name: customer_name.trim(),
    table_id: table_id.trim(),
    game_type,
    start_time: timeStr,
    end_time: null,
    duration: null,
    applied_pricing: null,
    cost: null,
    status: 'ACTIVE' as const,
    food_cost: 0,
    num_players,
    locked_rate: lockedRate,
    locked_rate_name: lockedRateName,
    member_id,
    notes,
  };

  await sessionRepository.create(session, businessId);
  Promise.resolve().then(async () => {
    try {
      const { enqueueSheetsSync } = require('./sheetsSyncQueue');
      enqueueSheetsSync('SESSION', session.id, businessId);
    } catch(e) { console.error('Failed to enqueue session sync to sheet', e); }
  }).catch(e => console.error(e));
  return session;
  } finally {
    activeTableLocks.delete(lockKey);
  }
}

export async function resolveSessionDiscount(session: any, businessId: string, business: any) {
  let discount = business?.active_discounts?.[session.table_id] || business?.active_discounts?.['all'];
  if (discount && discount.isActive === false) {
    discount = undefined;
  }
  const now = new Date();
  
  // Use parseDateString from billing.ts to fix timezone bugs
  const { parseDateString } = require('./billing');



  // Membership Discount Logic via Native DB
  try {
    if (businessId) {
      let member = null;
      
      // Use cached memberships
      const memberships = await getCachedMemberships(businessId);
      
      if (session.member_id) {
         member = memberships.find((m: any) => m.id === session.member_id);
      } else {
         const searchName = session.customer_name?.trim().toLowerCase();
         if (searchName) {
            member = memberships.find((m: any) => 
               (m.mobile && m.mobile.trim() === searchName) || 
               (m.name && m.name.trim().toLowerCase() === searchName)
            );
         }
      }
        
      if (member) {
        (session as any)._matchedMemberId = member.id;
        (session as any)._isRegisteredCustomer = true;

        const isStatusActive = !member.status || member.status.toLowerCase() === 'active';
        if (isStatusActive) {
          let memberDiscountPercent = 0;
          if (member.tier === 'Elite') memberDiscountPercent = 30;
          else if (member.tier === 'VIP') memberDiscountPercent = 20;
          else if (member.tier === 'Pro') memberDiscountPercent = 10;
          else if (member.tier === 'Standard') memberDiscountPercent = 5;
          
          const currentPercent = discount?.percent || 0;
          if (!discount || memberDiscountPercent > currentPercent) {
             discount = { type: 'percentage', percent: memberDiscountPercent, applyToFood: true, label: `${member.tier} Member Discount` } as any;
             (session as any)._appliedPromoId = undefined; // Promo didn't win
          }
        }
      }

      if (session.member_id && member) {
          (session as any)._isRegisteredCustomer = true;
      } else {
          const customers = await getCachedCustomers(businessId);
          const cName = session.customer_name?.trim().toLowerCase() || '';
          if (customers && cName && cName !== 'guest') {
            const match = customers.find((c: any) => 
              (c.name && c.name.trim().toLowerCase() === cName) || 
              (c.phone && c.phone.trim() === cName)
            );
            if (match) {
                (session as any)._isRegisteredCustomer = true;
                (session as any)._matchedCustomerId = match.id;
            }
          }
      }
    }
  } catch (e) {
    console.error('Membership Lookup Error:', e);
  }
  return discount;
}

export async function endSession(table_id: string, businessId?: string, source: string = 'System', amountPaid?: number, paymentMethod: string = 'Cash', dueDate?: string, splitPayments?: Array<{ method: string; amount: number }>) {
  const lockKey = `${businessId || 'global'}_${table_id}`;
  if (activeTableLocks.has(lockKey)) {
    throw new ApiError(409, 'Action in progress for this table, please wait.');
  }

  try {
    activeTableLocks.add(lockKey);

    const session = await sessionRepository.findActiveByTable(table_id, businessId);
    if (!session || !session.id) {
      throw new ApiError(404, 'No active session found for this table');
    }

    const now = new Date();
    const timeStr = now.toISOString();
    const end_time = timeStr;
    
    const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
    const endFull = end_time;
    
    const business = businessId ? await businessManager.getBusiness(businessId) : null;
    let pricingRules = business ? business.pricing_rules : undefined;
    
    let discount;
    if (business && businessId) {
      discount = await resolveSessionDiscount(session, businessId, business);
    }
    
    let totalPausedSecs = session.paused_duration_seconds || 0;
    if (session.paused_at) {
      const ongoingPausedSecs = Math.max(0, Math.floor((now.getTime() - new Date(session.paused_at).getTime()) / 1000));
      totalPausedSecs += ongoingPausedSecs;
    }

    const activePromotions = businessId ? await getCachedActivePromos(businessId) : [];
    
    const { calculateBilling, applySessionDiscounts } = require('./billing');

    const tableResult = calculateBilling(
      startFull, 
      endFull, 
      session.game_type, 
      pricingRules, 
      session.num_players || 1, 
      undefined, 
      totalPausedSecs, 
      session.locked_rate, 
      session.locked_rate_name,
      activePromotions
    );
    
    const rawFoodCost = session.food_cost || 0;
    const discResult = applySessionDiscounts(tableResult.cost, rawFoodCost, discount);

    const timeCost = discResult.finalTableCost;
    const finalFoodCost = discResult.finalFoodCost;
    const duration = tableResult.duration;
    const baseCost = tableResult.baseCost;
    const slabs_applied = tableResult.slabs_applied + 
      (discResult.totalDiscountAmount > 0 ? ` + Manual Discount (${discResult.discountAppliedLabel})` : '');

    // Track applied promos
    const usedPromos = activePromotions.filter((p: any) => tableResult.slabs_applied.includes(p.name));
    if (usedPromos.length > 0) {
      (session as any)._usedPromos = usedPromos;
    }

    const totalCost = discResult.finalTotalCost;
    const totalBaseCost = tableResult.baseCost + rawFoodCost;
    const promoDiscountAmount = tableResult.discountAmount || 0;
    const totalDiscountAmount = promoDiscountAmount + discResult.totalDiscountAmount;
    
    const validSplits = (splitPayments || []).filter(sp => Number(sp.amount) > 0);
    const isRegistered = !!((session as any)._matchedMemberId || (session as any)._isRegisteredCustomer);
    const isExplicitCredit = paymentMethod === 'QKhata' || !!dueDate;

    let actualAmountPaid: number;
    let payment_status = 'Paid';

    if (isExplicitCredit) {
      if (!isRegistered) {
        throw new ApiError(400, 'Walk-in customers must pay full bill amount. Register as member to use QKhata.');
      }
      actualAmountPaid = 0;
      payment_status = 'Pending';
    } else if (validSplits.length > 0) {
      const splitSum = validSplits.reduce((sum, sp) => sum + Number(sp.amount), 0);
      // If split sum is within timing tolerance (<= 50 rupees) of totalCost, treat as full payment
      if (splitSum >= totalCost || Math.abs(totalCost - splitSum) <= 50) {
        actualAmountPaid = totalCost;
        payment_status = 'Paid';
      } else {
        // Partial split
        if (!isRegistered) {
          throw new ApiError(400, 'Walk-in customers must pay full bill amount. Register as member to use QKhata.');
        }
        actualAmountPaid = splitSum;
        payment_status = actualAmountPaid === 0 ? 'Pending' : 'Partially Paid';
      }
    } else if (amountPaid === undefined || amountPaid === null) {
      // Authoritative full payment
      actualAmountPaid = totalCost;
      payment_status = 'Paid';
    } else {
      // amountPaid was explicitly passed
      if (amountPaid >= totalCost || Math.abs(totalCost - amountPaid) <= 50) {
        // Full payment (absorbing any slight time drift between UI snapshot and server execution)
        actualAmountPaid = totalCost;
        payment_status = 'Paid';
      } else {
        // Intentional underpayment
        if (!isRegistered) {
          throw new ApiError(400, 'Walk-in customers must pay full bill amount. Register as member to use QKhata.');
        }
        actualAmountPaid = Math.max(0, amountPaid);
        payment_status = actualAmountPaid === 0 ? 'Pending' : 'Partially Paid';
      }
    }

    let effectivePaymentMethod = paymentMethod;
    if (validSplits.length > 1) {
      effectivePaymentMethod = 'Split (' + validSplits.map(s => `${s.method}: ₹${s.amount}`).join(', ') + ')';
    } else if (validSplits.length === 1) {
      effectivePaymentMethod = validSplits[0].method;
    }

    let finalSource = source;
    // Check if session is linked to a booking to override source
    const { data: linkedBooking } = await supabase.from('bookings').select('id, customer_name, table_id').eq('session_id', session.id).single();
    if (linkedBooking) {
      finalSource = 'Manual Booking';
    }

    await sessionRepository.update(session.id, {
      end_time,
      status: 'COMPLETED',
      duration,
      applied_pricing: slabs_applied,
      cost: totalCost,
      base_cost: totalBaseCost,
      discount_amount: totalDiscountAmount,
      payment_status: payment_status,
      amount_paid: actualAmountPaid,
      payment_method: effectivePaymentMethod,
      completed_by: finalSource,
      paused_at: null,
      paused_duration_seconds: totalPausedSecs,
      member_id: (session as any)._matchedMemberId || session.member_id || null,
    } as any, businessId, true);

    // QKhata / Payment logic integration (Synchronous to prevent financial data loss)
    if (businessId) {
      try {
          const { createLedgerEntryAndPayment } = require('./services/paymentService');
          await createLedgerEntryAndPayment({
              businessId,
              sessionId: session.id,
              customerName: session.customer_name,
              customerId: (session as any)._matchedCustomerId || (session as any)._matchedMemberId,
              totalBilled: totalCost,
              amountPaid: actualAmountPaid,
              paymentMethod: effectivePaymentMethod,
              paymentStatus: payment_status,
              dueDate: dueDate,
              source: finalSource,
              splitPayments: validSplits.length > 0 ? validSplits : undefined
          });
      } catch (e) {
          console.error("QKhata/Payment Service Error", e);
      }
          
      // --- Notifications (Non-blocking) ---
      Promise.resolve().then(async () => {
          try {
              if ((session as any)._matchedMemberId || (session as any)._isRegisteredCustomer) {
                  const { data: customer } = await supabase
                    .from('customers')
                    .select('phone, outstanding_balance')
                    .eq('business_id', businessId)
                    .or(`name.ilike.${session.customer_name},phone.eq.${session.customer_name}`)
                    .limit(1)
                    .single();
                    
                  if (customer && customer.phone) {
                     const qkhataAmount = Math.max(0, totalCost - actualAmountPaid);
                     const msg = `Thank you for playing with us!\n\nToday's bill: ₹${totalCost}\nToday's QKhata amount: ₹${qkhataAmount}\nTotal outstanding QKhata balance: ₹${Math.round(customer.outstanding_balance)}\n\nThank you for visiting!`;
                     
                     const cleanPhone = normalizePhone(customer.phone) || '';
                     if (cleanPhone.length >= 10) {
                        const { sendWhatsAppText } = require('./whatsapp');
                        let overrideToken;
                        let overridePhoneId;
                        if (business && business.whatsapp_config && business.whatsapp_config.enabled) {
                            overrideToken = business.whatsapp_config.token;
                            overridePhoneId = business.whatsapp_config.phoneId;
                        }
                        await sendWhatsAppText(cleanPhone, msg, false, overrideToken, overridePhoneId);
                     }
                  }
              }
          } catch (e) {
              console.error("WhatsApp Notification Error", e);
          }
      }).catch(e => console.error(e));
    }

    if ((session as any)._matchedMemberId) {
      try {
        // 1 point per 100 spent (example logic)
        const earnedPoints = Math.floor(totalCost / 100);
        
        const { data: member } = await supabase.from('memberships').select('total_spend, loyalty_points').eq('id', (session as any)._matchedMemberId).single();
        if (member) {
           await supabase.from('memberships').update({
              total_spend: (member.total_spend || 0) + totalCost,
              loyalty_points: (member.loyalty_points || 0) + earnedPoints
           }).eq('id', (session as any)._matchedMemberId);
        }
      } catch (e) {
        console.error('Failed to update member points', e);
      }
    }

    if ((session as any)._usedPromos && (session as any)._usedPromos.length > 0) {
      try {
        for (const usedPromo of (session as any)._usedPromos) {
          const { data: promo } = await supabase.from('promotions').select('usage_count').eq('id', usedPromo.id).single();
          if (promo) {
             await supabase.from('promotions').update({
                usage_count: (promo.usage_count || 0) + 1
             }).eq('id', usedPromo.id);
          }
        }
      } catch (e) {
        console.error('Failed to increment promotion usage', e);
      }
    }

    // Sync booking status if this session was started from a booking (Non-blocking)
    Promise.resolve().then(async () => {
    try {
      if (linkedBooking) {
        await supabase.from('bookings').update({ status: 'completed', end_time: end_time.split('T')[1]?.substring(0, 8) }).eq('id', linkedBooking.id);
        const { logActivityToSheet } = require('./googleSheets');
        logActivityToSheet('BOOKING_COMPLETED', {
          user: finalSource,
          table: linkedBooking.table_id,
          details: `Booking ${linkedBooking.id} completed via Session ${session.id}`
        }, businessId).catch((e: Error) => console.error(e));
      }
    } catch (e) {
      console.error('Failed to sync booking completion', e);
    }
    }).catch(e => console.error(e));

    // Note: sessionRepository.update above already enqueues sheets sync via enqueueSheetsSync

    return { 
      session_id: session.id, 
      customer_name: session.customer_name, 
      table_id: session.table_id, 
      start_time: session.start_time, 
      duration, 
      cost: totalCost, 
      discounts: discount ? discount.percent : 0, 
      paused_duration_seconds: totalPausedSecs,
      end_time,
      date: session.date,
      game_type: session.game_type,
      num_players: session.num_players || 1,
      applied_pricing: slabs_applied,
      completed_by: finalSource
    };
  } finally {
    activeTableLocks.delete(lockKey);
  }
}

export async function getTableStatus(table_id: string, businessId?: string) {
  let businessName = '';
  const activeSession = await sessionRepository.findActiveByTable(table_id, businessId);
  if (activeSession) {
    // Auto-cutoff logic
    if (activeSession.start_time) {
      const startMs = new Date(activeSession.start_time).getTime();
      if (Date.now() - startMs > TWELVE_HOURS_MS) {
        try {
          await endSession(table_id, businessId);
          // Recursively call to get the idle status or just return idle
          return getTableStatus(table_id, businessId);
        } catch (e) {
          console.error(`Failed to auto-end session on station status`, e);
        }
      }
    }

    let pricingRules;
    let menuItems;
    let discount;
    let qpayConfig = undefined;
    let paymentQrConfig = undefined;
    let maxPlayers = 4;
    let configuredGameType = 'pool';
    if (businessId) {
      const business = await businessManager.getBusiness(businessId); // Removed forceRefresh to prevent DB overload
      pricingRules = business?.pricing_rules;
      menuItems = business?.menu_items;
      discount = business?.active_discounts?.[table_id];
      businessName = business?.business_name || businessName;
      qpayConfig = business?.qpay_config;
      paymentQrConfig = business?.payment_qr_config;
      
      const tableConfig = business?.tables?.find(t => t.id.toLowerCase().trim() === String(table_id).toLowerCase().trim());
      if (tableConfig) {
        if ((tableConfig as any).game_type) {
          configuredGameType = (tableConfig as any).game_type;
        } else if ((tableConfig as any).type) {
          configuredGameType = (tableConfig as any).type;
        }
        if ((tableConfig as any).max_players) {
          maxPlayers = parseInt((tableConfig as any).max_players, 10);
        }
      }

      // Fetch active promotion using central logic (without membership overhead for polling, unless we cache it, but let's just use resolveSessionDiscount)
      discount = await resolveSessionDiscount(activeSession, businessId, business);
    }

    return {
      status: 'active',
      id: activeSession.id,
      date: activeSession.date,
      customer_name: activeSession.customer_name,
      table_id: activeSession.table_id,
      game_type: activeSession.game_type,
      start_time: activeSession.start_time,
      pricingRules,
      menuItems,
      discount,
      food_cost: activeSession.food_cost || 0,
      num_players: activeSession.num_players || 1,
      paused_at: activeSession.paused_at,
      paused_duration_seconds: activeSession.paused_duration_seconds || 0,
      locked_rate: activeSession.locked_rate,
      locked_rate_name: activeSession.locked_rate_name,
      businessName,
      qpayConfig,
      paymentQrConfig,
      max_players: maxPlayers,
    };
  }

  let pricingRules;
  let menuItems;
  let discount;
  let configuredGameType = 'pool';
  let maxPlayers = 4;

  let qpayConfig = undefined;
  let paymentQrConfig = undefined;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    pricingRules = business?.pricing_rules;
    menuItems = business?.menu_items;
    discount = business?.active_discounts?.[table_id];
    businessName = business?.business_name || businessName;
    qpayConfig = business?.qpay_config;
    paymentQrConfig = business?.payment_qr_config;
    
    const tableConfig = business?.tables?.find(t => t.id.toLowerCase().trim() === String(table_id).toLowerCase().trim());
    if (tableConfig) {
      if ((tableConfig as any).game_type) {
        configuredGameType = (tableConfig as any).game_type;
      } else if ((tableConfig as any).type) {
        configuredGameType = (tableConfig as any).type;
      }
      if ((tableConfig as any).max_players) {
        maxPlayers = parseInt((tableConfig as any).max_players, 10);
      }
    }

    // Fetch active promotion using central logic for idle state (using a dummy session)
    discount = await resolveSessionDiscount({ table_id, customer_name: '' }, businessId, business);
  }

  return { 
    status: 'idle',
    table_id,
    pricingRules,
    menuItems,
    discount,
    game_type: configuredGameType,
    max_players: maxPlayers,
    businessName,
    qpayConfig,
    paymentQrConfig,
  };
}

export async function calculateServerBillingForSession(session: any, businessId: string, customEndTime?: string) {
  const business = await businessManager.getBusiness(businessId);
  const discount = await resolveSessionDiscount(session, businessId, business);
  
  const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
  const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
  const endFull = customEndTime || (isPaused ? session.paused_at : new Date().toISOString());
  
  const activePromotions = businessId ? await getCachedActivePromos(businessId) : [];
  
  const { calculateBilling, applySessionDiscounts } = require('./billing');
  const tableResult = calculateBilling(
    startFull,
    endFull,
    session.game_type,
    business?.pricing_rules,
    session.num_players || 1,
    undefined,
    session.paused_duration_seconds,
    session.locked_rate,
    session.locked_rate_name,
    activePromotions
  );
  
  const rawFoodCost = session.food_cost || 0;
  const discResult = applySessionDiscounts(tableResult.cost, rawFoodCost, discount);

  const promoDiscountOnTable = tableResult.discountAmount || 0;
  const totalDiscountAmount = promoDiscountOnTable + discResult.totalDiscountAmount;
  const totalBaseCost = tableResult.baseCost + rawFoodCost;

  return {
    ...tableResult,
    slabs_applied: tableResult.slabs_applied + (discResult.totalDiscountAmount > 0 ? ` + Manual Discount (${discResult.discountAppliedLabel})` : ''),
    tableCost: discResult.finalTableCost,
    baseTableCost: tableResult.baseCost,
    foodCost: discResult.finalFoodCost,
    baseFoodCost: rawFoodCost,
    cost: discResult.finalTotalCost,
    baseCost: tableResult.baseCost,
    totalBaseCost,
    tableDiscountAmount: discResult.tableDiscountAmount,
    foodDiscountAmount: discResult.foodDiscountAmount,
    manualDiscountAmount: discResult.totalDiscountAmount,
    totalDiscountAmount,
    discountConfig: discount,
    discountAppliedLabel: discResult.discountAppliedLabel,
  };
}
