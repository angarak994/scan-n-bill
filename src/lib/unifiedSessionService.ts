import { supabase } from './supabaseClient';
import { businessManager } from './businessManager';
import { 
  getBusinessTimezone, 
  getMonthKey, 
  formatDateInTimezone, 
  formatTimeInTimezone,
  getSessionsSheetTitle,
  getOrdersSheetTitle
} from './sheetsTimezone';

export interface UnifiedOrderItem {
  orderId: string;
  sessionId: string;
  timestamp: string;
  tableNo: string;
  customerName: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  orderStatus: string;
}

export interface UnifiedSessionData {
  sessionId: string;
  canonicalId: string;
  businessId: string;
  monthKey: string;
  sessionsSheetTitle: string;
  ordersSheetTitle: string;
  sessionRow: (string | number)[];
  orderItems: UnifiedOrderItem[];
  raw: {
    session: any;
    booking: any;
    member: any;
    payment: any;
    ordersCount: number;
    timezone: string;
  };
}

/**
 * Canonical column headers for monthly Sessions sheets (Sessions_YYYY_MM).
 * Clean, business-owner focused schema containing only required operational and financial data.
 */
export const UNIFIED_SESSION_HEADERS = [
  'Session ID',          // Col A (0)
  'Date',                // Col B (1)
  'Customer Name',       // Col C (2)
  'Table No',            // Col D (3)
  'Game Type',           // Col E (4)
  'Start Time',          // Col F (5)
  'End Time',            // Col G (6)
  'Duration',            // Col H (7)
  'Table Fee (₹)',       // Col I (8) - Base game / table charge
  'F&B Total (₹)',       // Col J (9) - Food & beverage orders total
  'Discount (₹)',        // Col K (10) - Discounts applied
  'Total Amount (₹)',    // Col L (11) - Authoritative Grand Total Payable
  'Payment Method',      // Col M (12) - Cash, UPI, Split, etc.
  'Payment Status',      // Col N (13) - Paid, Pending, Partial
  'Status',              // Col O (14) - ACTIVE | COMPLETED
  'Notes'                // Col P (15) - Operational notes
];

/**
 * Column headers for monthly Orders sheets (Orders_YYYY_MM).
 * Item-level food and beverage details linked by Session ID and Order ID.
 */
export const UNIFIED_ORDER_HEADERS = [
  'Order ID',            // Col A (0)
  'Session ID',          // Col B (1)
  'Order Time',          // Col C (2)
  'Table No',            // Col D (3)
  'Customer Name',       // Col E (4)
  'Item Name',           // Col F (5)
  'Quantity',            // Col G (6)
  'Unit Price (₹)',      // Col H (7)
  'Item Total (₹)',      // Col I (8)
  'Order Status'         // Col J (9) - pending, accepted, served, cancelled
];

/**
 * Central aggregator: brings together Sessions, Bookings, Members, Payments, and F&B orders
 * using persistent IDs and verified relationships.
 */
export async function fetchUnifiedSessionData(sessionId: string, explicitBusinessId?: string): Promise<UnifiedSessionData | null> {
  try {
    // 1. Fetch Session from Supabase
    let query = supabase.from('sessions').select('*').eq('id', sessionId);
    if (explicitBusinessId) {
      query = query.eq('business_id', explicitBusinessId);
    }
    const { data: session, error: sessionErr } = await query.maybeSingle();
    if (sessionErr || !session) {
      console.warn(`[UnifiedSession] Session not found: ${sessionId}`);
      return null;
    }

    const businessId = session.business_id;
    const business = await businessManager.getBusiness(businessId);
    const timezone = getBusinessTimezone(business);

    // 2. Fetch associated Booking (if this session originated from or was linked to a booking)
    const { data: linkedBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('session_id', sessionId)
      .eq('business_id', businessId)
      .maybeSingle();

    // 3. Fetch associated Member details if member_id is present
    let memberData: any = null;
    const memberId = session.member_id || linkedBooking?.member_id;
    if (memberId) {
      const { data: membership } = await supabase
        .from('memberships')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();

      if (membership) {
        memberData = membership;
      } else {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', memberId)
          .maybeSingle();
        if (customer) memberData = customer;
      }
    }

    // 4. Fetch associated Payment record
    const { data: paymentRecord } = await supabase
      .from('payments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Fetch associated Food & Beverage Orders from notifications
    const { data: orderNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .in('type', ['order_pending', 'order_accepted', 'order_served', 'order_rejected'])
      .order('created_at', { ascending: true });

    const menuItems = business?.menu_items || [];
    const menuItemPriceMap = new Map<string, number>();
    menuItems.forEach((item: any) => {
      if (item.name && typeof item.price === 'number') {
        menuItemPriceMap.set(item.name.toLowerCase().trim(), item.price);
      }
    });

    const sessionOrders: any[] = [];
    const itemizedOrderRows: UnifiedOrderItem[] = [];

    orderNotifs?.forEach(notif => {
      // Notification message format: itemsJson|orderTotal|session_id
      const parts = notif.message ? notif.message.split('|') : [];
      if (parts.length >= 3 && parts[parts.length - 1] === sessionId) {
        try {
          const itemsJson = parts.slice(0, parts.length - 2).join('|');
          const cart = JSON.parse(itemsJson);
          const orderTotal = parseFloat(parts[parts.length - 2]) || 0;
          const orderStatus = notif.type.replace('order_', '');
          const orderTimeReadable = formatTimeInTimezone(notif.created_at, timezone);

          sessionOrders.push({
            id: notif.id,
            cart,
            total: orderTotal,
            status: orderStatus,
            created_at: notif.created_at
          });

          // Unpack items into itemized records
          if (typeof cart === 'object' && cart !== null) {
            for (const [itemName, qty] of Object.entries(cart)) {
              const quantity = typeof qty === 'number' ? qty : parseInt(String(qty), 10) || 0;
              if (quantity <= 0) continue;

              const matchedPrice = menuItemPriceMap.get(itemName.toLowerCase().trim()) || 0;
              const lineTotal = matchedPrice * quantity;

              itemizedOrderRows.push({
                orderId: notif.id ? notif.id.split('-')[0].toUpperCase() : 'ORD',
                sessionId: session.id ? session.id.split('-')[0].toUpperCase() : sessionId,
                timestamp: orderTimeReadable,
                tableNo: session.table_id || '',
                customerName: session.customer_name || 'Guest',
                itemName,
                quantity,
                unitPrice: matchedPrice,
                itemTotal: lineTotal,
                orderStatus
              });
            }
          }
        } catch (e) {
          console.warn('[UnifiedSession] Failed to parse order notification:', e);
        }
      }
    });

    // 6. Authoritative Financial Calculations
    // All values derive directly from QControl's database fields, never recalculated from assumptions.
    const grandTotal = typeof session.cost === 'number' ? session.cost : 0;
    const foodCost = typeof session.food_cost === 'number' ? session.food_cost : 0;
    const discountAmount = typeof session.discount_amount === 'number' ? session.discount_amount : 0;
    
    // Table fee = base_cost if stored, otherwise (grandTotal - foodCost + discount)
    const tableFee = typeof session.base_cost === 'number' 
      ? session.base_cost 
      : Math.max(0, grandTotal - foodCost + discountAmount);

    const isQKhata = paymentRecord?.payment_method === 'QKhata';
    const paymentMethod = paymentRecord?.payment_method || session.payment_method || 'Cash';
    const paymentStatus = session.payment_status || paymentRecord?.status || 'Pending';
    const qkhataStatus = isQKhata ? 'Charged' : (paymentStatus === 'Pending' ? 'Pending' : 'N/A');

    // 7. Time and Formatting
    const shortSessionId = session.id ? session.id.split('-')[0].toUpperCase() : 'UNKNOWN';
    const canonicalId = `SES-${shortSessionId}`;
    
    // Month partitioning based on authoritative session start_time
    const monthKey = getMonthKey(session.start_time, timezone);
    const sessionsSheetTitle = getSessionsSheetTitle(monthKey);
    const ordersSheetTitle = getOrdersSheetTitle(monthKey);

    const formattedDate = formatDateInTimezone(session.start_time, timezone);
    const formattedStartTime = formatTimeInTimezone(session.start_time, timezone);

    // Authoritative End Time resolution:
    // - Show 'Active' ONLY while a session is genuinely ongoing (ACTIVE or PAUSED).
    // - Once stopped, completed, or cancelled, write the actual end timestamp in the business timezone.
    // - Never leave 'Active' or blank for completed sessions.
    const isOngoing = session.status === 'ACTIVE' || session.status === 'PAUSED';
    let formattedEndTime: string;

    if (isOngoing) {
      formattedEndTime = session.end_time ? formatTimeInTimezone(session.end_time, timezone) : 'Active';
    } else {
      // Completed, Stopped, or Cancelled session
      const effectiveEndTime = session.end_time || session.last_activity_at || session.updated_at || new Date().toISOString();
      formattedEndTime = formatTimeInTimezone(effectiveEndTime, timezone);
      if (formattedEndTime === 'Active' || !formattedEndTime) {
        formattedEndTime = formatTimeInTimezone(new Date().toISOString(), timezone);
      }
    }

    const effectiveStatus = session.paused_at ? 'PAUSED' : (session.status || 'ACTIVE');

    const customerDisplay = session.num_players && session.num_players > 1
      ? `${session.customer_name} (${session.num_players} Players)`
      : (session.customer_name || 'Guest');

    const ordersCountText = sessionOrders.length > 0 
      ? `${sessionOrders.length} Order${sessionOrders.length > 1 ? 's' : ''}` 
      : 'None';

    const memberIdDisplay = memberData?.id ? memberData.id.split('-')[0].toUpperCase() : 'None';
    const memberTierDisplay = memberData?.tier || 'N/A';
    const bookingIdDisplay = linkedBooking?.id ? linkedBooking.id.split('-')[0].toUpperCase() : 'None';

    // 8. Construct Canonical Row for Sessions_YYYY_MM (Matching UNIFIED_SESSION_HEADERS)
    const sessionRow = [
      canonicalId,                                             // Session ID
      formattedDate,                                           // Date
      customerDisplay,                                         // Customer Name
      session.table_id || '',                                  // Table No
      session.game_type || '',                                 // Game Type
      formattedStartTime,                                      // Start Time
      formattedEndTime,                                        // End Time
      session.duration || '0m',                                // Duration
      tableFee,                                                // Table Fee (₹)
      foodCost,                                                // F&B Total (₹)
      discountAmount,                                          // Discount (₹)
      grandTotal,                                              // Total Amount (₹)
      paymentMethod,                                           // Payment Method
      paymentStatus,                                           // Payment Status
      effectiveStatus,                                         // Status
      session.notes || ''                                      // Notes
    ];

    return {
      sessionId: session.id,
      canonicalId,
      businessId,
      monthKey,
      sessionsSheetTitle,
      ordersSheetTitle,
      sessionRow,
      orderItems: itemizedOrderRows,
      raw: {
        session,
        booking: linkedBooking,
        member: memberData,
        payment: paymentRecord,
        ordersCount: sessionOrders.length,
        timezone
      }
    };
  } catch (err) {
    console.error(`[UnifiedSession] Error gathering unified session data (${sessionId}):`, err);
    return null;
  }
}
