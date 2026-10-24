import { supabase } from '@/lib/supabaseClient';
import { businessManager } from '@/lib/businessManager';
import { getBusinessTimezone, formatDateInTimezone } from '@/lib/sheetsTimezone';

export interface QpulseInsight {
  dashboard: {
    message: string;
    stat: string;
    subtext: string;
    metrics?: {
      dateRange: string;
      totalRevenue: number;
      tableRevenue: number;
      foodRevenue: number;
      totalCollections: number;
      outstandingAmount: number;
      completedSessions: number;
      validBookings: number;
      avgSessionTicket: number;
    };
  };
  telegram: string;
}

/**
 * Authoritatively generates QPulse Insights grounded strictly in verified database records.
 * Deterministic financial calculations — zero hallucination, zero data invention across tenants.
 */
export async function generateQpulseInsight(businessId: string): Promise<QpulseInsight | null> {
  try {
    const business = await businessManager.getBusiness(businessId);
    if (!business) return null;

    const qpulseConfig = (business.qpulse_config || {}) as any;
    if (qpulseConfig.enabled === false) return null;

    const timezone = getBusinessTimezone(business);
    const nowIst = new Date();
    const todayDateStr = formatDateInTimezone(nowIst.toISOString(), timezone);

    // Business-local 30-day window
    const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const startDateStr = formatDateInTimezone(new Date(thirtyDaysAgoMs).toISOString(), timezone);

    // 1. Authoritative completed sessions query (exclude active, cancelled, no-show)
    const { data: rawSessions } = await supabase
      .from('sessions')
      .select('id, cost, base_cost, food_cost, discount_amount, game_type, date, start_time, end_time, payment_status, amount_paid')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .or(`and(date.gte.${startDateStr},date.lte.${todayDateStr}),and(end_time.gte.${startDateStr}T00:00:00,end_time.lte.${todayDateStr}T23:59:59)`);

    const sessions = rawSessions || [];

    // 2. Authoritative payments query for actual collected revenue
    const { data: rawPayments } = await supabase
      .from('payments')
      .select('id, amount, status, payment_method, metadata, created_at')
      .eq('business_id', businessId)
      .gte('created_at', new Date(thirtyDaysAgoMs).toISOString());

    const payments = rawPayments || [];

    // 3. Authoritative bookings query
    const { data: rawBookings } = await supabase
      .from('bookings')
      .select('id, status, booking_date')
      .eq('business_id', businessId)
      .gte('booking_date', startDateStr)
      .lte('booking_date', todayDateStr);

    const bookings = rawBookings || [];

    // 4. Data sufficiency verification (strict zero-hallucination requirement)
    if (sessions.length < 3) {
      return {
        dashboard: {
          message: "Data Gathering in Progress",
          stat: `${sessions.length} session${sessions.length === 1 ? '' : 's'} recorded (${startDateStr} to ${todayDateStr})`,
          subtext: "Insufficient session data to generate detailed trends yet. Complete more sessions to unlock performance patterns!"
        },
        telegram: `📊 Insufficient session data to generate detailed 30-day trends yet (${sessions.length} completed session${sessions.length === 1 ? '' : 's'} from ${startDateStr} to ${todayDateStr}). Complete more sessions to unlock insights!`
      };
    }

    // 5. Deterministic numerical metrics
    let grossTotalRevenue = 0;
    let totalFoodRevenue = 0;
    let totalTableRevenue = 0;
    let totalOutstanding = 0;

    const gameCounts: Record<string, number> = {};
    const dayCounts: Record<number, number> = {};

    sessions.forEach(s => {
      const cost = Number(s.cost) || 0;
      const food = Number(s.food_cost) || 0;
      const disc = Number(s.discount_amount) || 0;
      const table = Math.max(0, cost - food + disc);

      grossTotalRevenue += cost;
      totalFoodRevenue += food;
      totalTableRevenue += table;

      const paid = Number(s.amount_paid);
      if (s.payment_status !== 'Paid') {
        const remaining = isNaN(paid) ? cost : Math.max(0, cost - paid);
        totalOutstanding += remaining;
      }

      const g = (s.game_type || 'pool').toLowerCase();
      gameCounts[g] = (gameCounts[g] || 0) + 1;

      if (s.date) {
        const dayOfWeek = new Date(s.date).getDay();
        if (!isNaN(dayOfWeek)) {
          dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
        }
      }
    });

    // Actual collections from payments ledger
    let totalCollections = 0;
    payments.forEach(p => {
      if (p.status === 'Paid' && p.metadata?.type !== 'CHARGE') {
        totalCollections += Number(p.amount) || 0;
      }
    });

    const validBookings = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'no_show').length;
    const avgSessionTicket = Math.round(grossTotalRevenue / sessions.length);

    const sortedGames = Object.entries(gameCounts).sort((a, b) => b[1] - a[1]);
    const bestGame = sortedGames[0]?.[0] || 'pool';
    const bestGameCount = sortedGames[0]?.[1] || 0;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
    const bestDayNum = sortedDays[0] ? parseInt(sortedDays[0][0], 10) : 0;
    const busiestDay = days[bestDayNum] || 'Saturday';
    const busiestDayCount = sortedDays[0]?.[1] || 0;

    const foodSharePct = grossTotalRevenue > 0 ? Math.round((totalFoodRevenue / grossTotalRevenue) * 100) : 0;

    // Grounded insight selection based on factual business metrics
    const metricsPayload = {
      dateRange: `${startDateStr} to ${todayDateStr}`,
      totalRevenue: Math.round(grossTotalRevenue),
      tableRevenue: Math.round(totalTableRevenue),
      foodRevenue: Math.round(totalFoodRevenue),
      totalCollections: Math.round(totalCollections),
      outstandingAmount: Math.round(totalOutstanding),
      completedSessions: sessions.length,
      validBookings,
      avgSessionTicket
    };

    let dashboardMsg = "Strong Financial Performance";
    let dashboardStat = `₹${Math.round(grossTotalRevenue).toLocaleString('en-IN')} revenue across ${sessions.length} sessions`;
    let dashboardSubtext = `Avg ticket: ₹${avgSessionTicket} • Collections: ₹${Math.round(totalCollections).toLocaleString('en-IN')}`;
    let telegramMsg = `💰 <b>30-Day Revenue Summary (${startDateStr} to ${todayDateStr}):</b>\n\n` +
      `• Total Billed: ₹${Math.round(grossTotalRevenue).toLocaleString('en-IN')}\n` +
      `• Table Revenue: ₹${Math.round(totalTableRevenue).toLocaleString('en-IN')}\n` +
      `• F&B Revenue: ₹${Math.round(totalFoodRevenue).toLocaleString('en-IN')} (${foodSharePct}% of total)\n` +
      `• Actual Collected: ₹${Math.round(totalCollections).toLocaleString('en-IN')}\n` +
      `• Outstanding Dues: ₹${Math.round(totalOutstanding).toLocaleString('en-IN')}\n` +
      `• Completed Sessions: ${sessions.length} (Avg ₹${avgSessionTicket}/session)\n` +
      `• Top Game: ${bestGame.toUpperCase()} (${bestGameCount} sessions)\n` +
      `• Busiest Day: ${busiestDay} (${busiestDayCount} sessions)`;

    if (totalFoodRevenue > 0 && foodSharePct >= 20) {
      dashboardMsg = "F&B is Driving Revenue";
      dashboardStat = `₹${Math.round(totalFoodRevenue).toLocaleString('en-IN')} from F&B (${foodSharePct}% of revenue)`;
      dashboardSubtext = `Busiest day: ${busiestDay} (${busiestDayCount} sessions) • Top Game: ${bestGame.toUpperCase()}`;
    } else if (busiestDayCount > 0) {
      dashboardMsg = "Peak Operating Patterns";
      dashboardStat = `${busiestDay} is your busiest day (${busiestDayCount} sessions)`;
      dashboardSubtext = `Top Game: ${bestGame.toUpperCase()} (${bestGameCount} sessions) • Avg Ticket: ₹${avgSessionTicket}`;
    }

    return {
      dashboard: {
        message: dashboardMsg,
        stat: dashboardStat,
        subtext: dashboardSubtext,
        metrics: metricsPayload
      },
      telegram: telegramMsg
    };

  } catch (error) {
    console.error('Error generating Qpulse insight:', error);
    return null;
  }
}
