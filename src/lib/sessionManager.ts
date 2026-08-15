import { v4 as uuid } from 'uuid';
import { sessionRepository, Session } from './repositories/sessionRepository';
import { GameType } from './pricing';
import { calculateBilling, getCurrentISTDateStr } from './billing';
import { businessManager } from './businessManager';
import { supabase } from './supabaseClient';
import { resolveRate } from './pricing';

// Use ISO strings for robust time storage
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function startSession(table_id: string, game_type: GameType, customer_name: string, businessId?: string, num_players: number = 1) {
  const existingSession = await sessionRepository.findActiveByTable(table_id, businessId);
  if (existingSession) {
    throw new ApiError(400, 'A session is already active for this table');
  }

  if (!customer_name || customer_name.trim() === '') {
    throw new ApiError(400, 'Customer Name is mandatory');
  }

  const now = new Date();
  
  // Resolve rate
  let lockedRate = undefined;
  let lockedRateName = undefined;
  if (businessId) {
    const { data: pricingRules } = await supabase.from('pricing_rules').select('*').eq('business_id', businessId);
    if (pricingRules) {
      const activeRule = resolveRate(game_type, pricingRules, now);
      if (activeRule) {
        lockedRate = activeRule.rate_per_hour;
        lockedRateName = activeRule.rule_type;
      }
    }
  }

  const dateStr = getCurrentISTDateStr(); // IST Date
  const timeStr = now.toISOString(); // Full ISO timestamp
  
  const session: Session = {
    id: uuid(),
    date: dateStr,
    customer_name: customer_name.trim(),
    table_id,
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
  };

  await sessionRepository.create(session, businessId);
  return session;
}

export async function endSession(table_id: string, businessId?: string) {
  const session = await sessionRepository.findActiveByTable(table_id, businessId);
  if (!session || !session.id) {
    throw new ApiError(404, 'No active session found for this table');
  }

  const now = new Date();
  const timeStr = now.toISOString();
  const end_time = timeStr;
  
  // Backward compatibility: If it's an old session, start_time is just "07:35 PM". We need to combine it with the date.
  const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
  const endFull = end_time;
  
  // Fetch business to get pricing and discounts
  const business = businessId ? await businessManager.getBusiness(businessId) : null;
  let pricingRules;
  let discount;
  if (business) {
    pricingRules = business.pricing_rules;
    discount = business.active_discounts?.[table_id];
    
    // Fetch active promotion from db
    const { data: activePromos } = await supabase
      .from('promotions')
      .select('id, discount_percent, end_time')
      .eq('business_id', business.id)
      .eq('status', 'Active')
      .limit(1);

    const activePromo = activePromos?.[0];
    const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > now.getTime();
    if (!discount && isPromoValid) {
      discount = { percent: activePromo.discount_percent, applyToFood: false };
      (session as any)._appliedPromoId = activePromo.id;
    }
  }
  
  // Membership Discount Logic via Native DB
  try {
    if (businessId) {
      const { data: member } = await supabase
        .from('memberships')
        .select('*')
        .eq('business_id', businessId)
        .or(`mobile.eq.${session.customer_name},name.eq.${session.customer_name}`)
        .limit(1)
        .single();
        
      if (member && member.status === 'Active') {
        // Define tier discounts
        let memberDiscountPercent = 0;
        if (member.tier === 'Elite') memberDiscountPercent = 30;
        else if (member.tier === 'VIP') memberDiscountPercent = 20;
        else if (member.tier === 'Pro') memberDiscountPercent = 10;
        else if (member.tier === 'Standard') memberDiscountPercent = 5;
        
        // Use member discount if better than promo (and unset promo flag since it wasn't the winning discount)
        if (!discount || memberDiscountPercent > discount.percent) {
           discount = { percent: memberDiscountPercent, applyToFood: true, message: `${member.tier} Member Discount` } as any;
           (session as any)._appliedPromoId = undefined; // Promo didn't win
        }

        // We will increment total_spend and loyalty_points later after final math
        (session as any)._matchedMemberId = member.id;
      }
    }
  } catch (e) {
    console.error('Membership Lookup Error:', e);
  }
  
  let totalPausedSecs = session.paused_duration_seconds || 0;
  if (session.paused_at) {
    const ongoingPausedSecs = Math.max(0, Math.floor((now.getTime() - new Date(session.paused_at).getTime()) / 1000));
    totalPausedSecs += ongoingPausedSecs;
  }

  const { duration, cost: timeCost, baseCost, discountAmount, slabs_applied } = calculateBilling(
    startFull, 
    endFull, 
    session.game_type, 
    pricingRules, 
    session.num_players || 1, 
    discount, 
    totalPausedSecs, 
    session.locked_rate, 
    session.locked_rate_name
  );
  
  let finalFoodCost = session.food_cost || 0;
  let foodDiscountAmount = 0;
  if (discount && discount.percent > 0 && discount.applyToFood) {
    const originalFoodCost = finalFoodCost;
    finalFoodCost = finalFoodCost * (1 - (discount.percent / 100));
    finalFoodCost = Math.round(finalFoodCost);
    foodDiscountAmount = originalFoodCost - finalFoodCost;
  }

  const totalCost = timeCost + finalFoodCost;
  const totalBaseCost = baseCost + (session.food_cost || 0);
  const totalDiscountAmount = discountAmount + foodDiscountAmount;

  await sessionRepository.update(session.id, {
    end_time,
    status: 'COMPLETED',
    duration,
    applied_pricing: slabs_applied,
    cost: totalCost,
    base_cost: totalBaseCost,
    discount_amount: totalDiscountAmount,
    payment_status: 'Paid',
    completed_by: 'Club Owner', // Default to club owner for manual dashboard actions
    paused_at: null,
    paused_duration_seconds: totalPausedSecs,
  }, businessId);

  if ((session as any)._matchedMemberId) {
    try {
      // 1 point per 100 spent (example logic)
      const earnedPoints = Math.floor(totalCost / 100);
      
      // Update member using RPC or manual fetch/update. 
      // Supabase doesn't have an atomic increment without RPC, so we fetch and update.
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

  if ((session as any)._appliedPromoId) {
    try {
      const { data: promo } = await supabase.from('promotions').select('usage_count').eq('id', (session as any)._appliedPromoId).single();
      if (promo) {
         await supabase.from('promotions').update({
            usage_count: (promo.usage_count || 0) + 1
         }).eq('id', (session as any)._appliedPromoId);
      }
    } catch (e) {
      console.error('Failed to increment promotion usage', e);
    }
  }

  // Sync booking status if this session was started from a booking
  try {
    const { data: booking } = await supabase.from('bookings').select('id, customer_name, table_id').eq('session_id', session.id).single();
    if (booking) {
      await supabase.from('bookings').update({ status: 'completed', end_time: end_time.split('T')[1]?.substring(0, 8) }).eq('id', booking.id);
      const { logActivityToSheet } = require('./googleSheets');
      await logActivityToSheet('BOOKING_COMPLETED', {
        user: 'System',
        table: booking.table_id,
        details: `Booking ${booking.id} completed via Session ${session.id}`
      }, businessId);
    }
  } catch (e) {
    console.error('Failed to sync booking completion', e);
  }

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
    applied_pricing: slabs_applied
  };
}

export async function getTableStatus(table_id: string, businessId?: string) {
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
    if (businessId) {
      const business = await businessManager.getBusiness(businessId);
      pricingRules = business?.pricing_rules;
      menuItems = business?.menu_items;
      discount = business?.active_discounts?.[table_id];
      // Fetch active promotion
      const { data: activePromos } = await supabase
        .from('promotions')
        .select('discount_percent, end_time')
        .eq('business_id', businessId)
        .eq('status', 'Active')
        .limit(1);
      
      const activePromo = activePromos?.[0];
      const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > Date.now();
      if (!discount && isPromoValid) {
        discount = { percent: activePromo.discount_percent, applyToFood: false };
      }
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
    };
  }

  let pricingRules;
  let menuItems;
  let discount;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    pricingRules = business?.pricing_rules;
    menuItems = business?.menu_items;
    discount = business?.active_discounts?.[table_id];
    // Fetch active promotion
    const { data: activePromos } = await supabase
      .from('promotions')
      .select('discount_percent, end_time')
      .eq('business_id', businessId)
      .eq('status', 'Active')
      .limit(1);
    
    const activePromo = activePromos?.[0];
    const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > Date.now();
    if (!discount && isPromoValid) {
      discount = { percent: activePromo.discount_percent, applyToFood: false };
    }
  }

  return { 
    status: 'idle',
    table_id,
    pricingRules,
    menuItems,
    discount,
  };
}
