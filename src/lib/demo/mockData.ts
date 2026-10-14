// A comprehensive, consistent mock dataset for the QControl Static Demo

const now = new Date();
const todayDate = now.toISOString().split('T')[0];
const yesterdayDate = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000).toISOString();
const oneHourAgo = new Date(now.getTime() - 60 * 60000).toISOString();

const twoHoursAgo = new Date(now.getTime() - 120 * 60000).toISOString();
const threeHoursAgo = new Date(now.getTime() - 180 * 60000).toISOString();

const futureOneHour = new Date(now.getTime() + 60 * 60000).toTimeString().substring(0, 5);
const futureThreeHours = new Date(now.getTime() + 180 * 60000).toTimeString().substring(0, 5);

export const mockDashboardData = {
    activeSessions: [
        {
            id: "sess-active-1",
            business_id: "demo-business-123",
            customer_name: "Priya Patel",
            table_id: "T3",
            game_type: "pool",
            start_time: thirtyMinsAgo,
            end_time: null,
            status: "ACTIVE",
            date: todayDate,
            duration: null,
            cost: null,
            payment_status: null
        },
        {
            id: "sess-active-2",
            business_id: "demo-business-123",
            customer_name: "Guest 101",
            table_id: "T5",
            game_type: "snooker",
            start_time: oneHourAgo,
            end_time: null,
            status: "ACTIVE",
            date: todayDate,
            duration: null,
            cost: null,
            payment_status: null
        }
    ],
    completedSessions: [
        {
            id: "sess-comp-1",
            business_id: "demo-business-123",
            customer_name: "Arjun Sharma",
            table_id: "T1",
            game_type: "pool",
            start_time: threeHoursAgo,
            end_time: twoHoursAgo,
            duration: "1h 0m",
            cost: 200,
            base_cost: 200,
            food_cost: 0,
            status: "COMPLETED",
            payment_status: "Paid",
            date: todayDate,
            completed_by: "Demo Admin"
        },
        {
            id: "sess-comp-2",
            business_id: "demo-business-123",
            customer_name: "Rohit Verma",
            table_id: "VIP1",
            game_type: "snooker",
            start_time: new Date(now.getTime() - 240 * 60000).toISOString(),
            end_time: threeHoursAgo,
            duration: "1h 0m",
            cost: 350,
            base_cost: 350,
            food_cost: 0,
            status: "COMPLETED",
            payment_status: "Paid",
            date: todayDate,
            completed_by: "Demo Admin"
        }
    ],
    dailyRevenue: 550,
    kpis: { totalRevenue: 550, totalSessions: 2 },
    todayStr: todayDate,
    pricingRules: {
        rules: {
            pool: { type: "fixed", rate: 200 },
            snooker: { type: "fixed", rate: 350 }
        },
        globalSettings: {
            rounding_mode: "nearest_5",
            enable_peak_rules: false,
            currency: "INR"
        }
    },
    tables: [
        { id: "T1", name: "Table 1", type: "pool" },
        { id: "T2", name: "Table 2", type: "pool" },
        { id: "T3", name: "Table 3", type: "pool" },
        { id: "T4", name: "Table 4", type: "pool" },
        { id: "T5", name: "Table 5", type: "snooker" },
        { id: "VIP1", name: "VIP Room", type: "pool" }
    ],
    activeDiscounts: {},
    manualClosuresToday: 0,
    revenueSavedToday: 0,
    bookings: [
        {
            id: "book-1",
            business_id: "demo-business-123",
            customer_name: "Vikram Mehta",
            customer_phone: "9988112233",
            table_id: "T2",
            booking_date: todayDate,
            start_time: futureOneHour,
            duration_minutes: 60,
            status: "confirmed",
            source: "manual",
            game_type: "pool"
        },
        {
            id: "book-2",
            business_id: "demo-business-123",
            customer_name: "Anjali Desai",
            customer_phone: "9123456789",
            table_id: "VIP1",
            booking_date: todayDate,
            start_time: futureThreeHours,
            duration_minutes: 120,
            status: "confirmed",
            source: "whatsapp",
            game_type: "snooker"
        }
    ],
    activePromotions: [
        {
            id: "promo-1",
            name: "DIWALI50",
            discount_percent: 50,
            start_time: new Date(now.getTime() - 86400000).toISOString(),
            end_time: new Date(now.getTime() + 15 * 86400000).toISOString(), // Ends in 15 days
            status: "Active"
        }
    ],
    dbCustomers: [
        { id: "cust-1", name: "Arjun Sharma", phone: "9876543210", outstanding_balance: 1450 },
        { id: "cust-2", name: "Rohit Verma", phone: "9001122334", outstanding_balance: -200 }
    ],
    memberships: [
        { id: "mem-1", name: "Arjun Sharma", mobile: "9876543210", points: 450 },
        { id: "mem-2", name: "Priya Patel", mobile: "9123456789", points: 120 }
    ],
    businessId: "demo-business-123",
    businessName: "Strike Zone (Demo)",
    ownerName: "Demo Admin",
    has_logged_in: true,
    goals: { daily_revenue: 1000, weekly_revenue: 7000, monthly_revenue: 30000, daily_sessions: 10 },
    google_sheet_id: null,
    payment_qr_config: null,
    whatsapp_config: { enabled: false },
    menu_items: [
        { id: 'F1', name: 'Coke', price: 50, category: 'Beverages' },
        { id: 'F2', name: 'French Fries', price: 120, category: 'Food' },
        { id: 'F3', name: 'Red Bull', price: 150, category: 'Beverages' },
        { id: 'F4', name: 'Club Sandwich', price: 180, category: 'Food' }
    ],
    entitlement: {
       features: ['whatsapp_alerts', 'qkhata', 'advanced_analytics', 'food_menu', 'telegram_bot'],
       planName: 'Growth'
    },
    foodOrders: [],
    membership_plans: [
        { id: "plan-1", name: "Gold Tier", price: 1500, validity_days: 30, discount_percentage: 15 }
    ],
    qKhataTransactions: [
        {
            id: "txn-1",
            customer_name: "Arjun Sharma",
            amount: 1450,
            type: "credit",
            description: "Table time pending",
            created_at: yesterdayDate
        },
        {
            id: "txn-2",
            customer_name: "Rohit Verma",
            amount: 200,
            type: "payment",
            description: "Advance payment",
            created_at: todayDate
        }
    ]
};

export const mockReportsData = {
    dailyRevenue: [
        { date: yesterdayDate, revenue: 1200 },
        { date: todayDate, revenue: 550 }
    ],
    tableUtilization: [
        { table_name: "Table 1", hours: 4.5 },
        { table_name: "VIP Room", hours: 6.2 },
        { table_name: "Table 3", hours: 2.1 }
    ],
    gameTypeSplit: [
        { game_type: "pool", revenue: 850 },
        { game_type: "snooker", revenue: 900 }
    ]
};

export const mockReportsSummary = {
  asOf: "14 Oct 2026, 9:42 pm IST",
  businessId: "demo-business-123",
  businessName: "Strike Zone (Demo)",
  timezone: "Asia/Kolkata",
  period: "thisMonth",
  periodLabel: "1–14 Oct",
  comparisonLabel: "vs 1–14 Sep",
  hasComparison: true,

  primary: {
    revenue: {
      value: 184260,
      previous: 163932,
      deltaPct: 12.4,
      deltaFormatted: "+12.4%",
      direction: "up",
      isPositive: true,
      sparkline: [12000, 14000, 11500, 16000, 15000, 18500, 19200],
      tooltip: "Total economic value earned from completed sessions and F&B in the period after discounts.",
      subtext: "Billed after discounts"
    },
    collected: {
      value: 169840,
      previous: 155673,
      deltaPct: 9.1,
      deltaFormatted: "+9.1%",
      direction: "up",
      isPositive: true,
      sparkline: [11000, 13000, 10500, 14500, 14000, 17000, 18100],
      tooltip: "Money actually received in the period (cash, UPI, card, dues settlements).",
      subtext: "Money actually received"
    },
    pendingDues: {
      value: 14420,
      previous: 14897,
      deltaPct: -3.2,
      deltaFormatted: "-3.2% lower",
      direction: "down",
      isPositive: true,
      sparkline: [16100, 15500, 14420],
      tooltip: "Point-in-time outstanding customer balances (QKhata and unpaid session bills).",
      subtext: "Outstanding as of today"
    },
    netCashFlow: {
      value: 139950,
      previous: 129583,
      deltaPct: 8.0,
      deltaFormatted: "+8.0%",
      direction: "up",
      isPositive: true,
      sparkline: [9500, 11000, 8500, 12000, 11500, 14000, 15200],
      tooltip: "External cash inflows minus outflows (refunds paid + recorded expenses).",
      subtext: "Collected – refunds – expenses"
    }
  },

  secondary: {
    discounts: {
      value: 6120,
      label: "Discounts",
      tooltip: "Total promotional and manual discounts applied to sessions in the period."
    },
    refunds: {
      value: 1350,
      label: "Refunds",
      tooltip: "Total money returned or voided in the period."
    },
    expenses: {
      value: 28540,
      isAvailable: false,
      label: "Expenses",
      reason: "Expense logging is not set up"
    },
    sessions: {
      total: 612,
      completed: 588,
      cancelled: 24,
      subtext: "588 completed · 24 cancelled"
    },
    avgPerSession: {
      value: 240,
      subtext: "Table revenue / completed"
    },
    fbRevenue: {
      value: 42900,
      sharePct: 23.3,
      subtext: "23.3% of revenue"
    }
  },

  moneyMovement: {
    totalBilled: 184260,
    collected: 169840,
    collectedPct: 92,
    pending: 14420,
    pendingPct: 8,
    isProvable: true,
    header: "Billed ₹1,84,260 = collected + still pending",
    footer: "Pending ₹14,420 is owed by customers (QKhata and unpaid bills)."
  },

  trends: {
    granularity: "daily",
    points: [
      { key: "1", label: "1 Oct", revenue: 7000, collected: 6200, prevCollected: 5800 },
      { key: "2", label: "2 Oct", revenue: 7800, collected: 7200, prevCollected: 6200 },
      { key: "3", label: "3 Oct", revenue: 7500, collected: 7000, prevCollected: 6500 },
      { key: "4", label: "4 Oct", revenue: 8200, collected: 7600, prevCollected: 6700 },
      { key: "5", label: "5 Oct", revenue: 7900, collected: 7300, prevCollected: 6400 },
      { key: "6", label: "6 Oct", revenue: 9500, collected: 8900, prevCollected: 7200 },
      { key: "7", label: "7 Oct", revenue: 11000, collected: 10200, prevCollected: 8400 },
      { key: "8", label: "8 Oct", revenue: 10500, collected: 9800, prevCollected: 8000 },
      { key: "9", label: "9 Oct", revenue: 12200, collected: 11400, prevCollected: 8800 },
      { key: "10", label: "10 Oct", revenue: 11800, collected: 10900, prevCollected: 8500 },
      { key: "11", label: "11 Oct", revenue: 13500, collected: 12400, prevCollected: 9200 },
      { key: "12", label: "12 Oct", revenue: 13000, collected: 12100, prevCollected: 9400 },
      { key: "13", label: "13 Oct", revenue: 14200, collected: 13100, prevCollected: 10100 },
      { key: "14", label: "14 Oct", revenue: 15160, collected: 14240, prevCollected: 11200 }
    ]
  },

  paymentMethods: {
    rows: [
      { method: "UPI", collected: 94380, txnCount: 318, sharePct: 55.5, refunds: 900, net: 93480 },
      { method: "Cash", collected: 58900, txnCount: 203, sharePct: 34.7, refunds: 450, net: 58450 },
      { method: "Card", collected: 16640, txnCount: 61, sharePct: 9.8, refunds: 0, net: 16640 }
    ],
    totalRow: {
      collected: 169840,
      txnCount: 582,
      sharePct: 100,
      refunds: -1350,
      net: 168490
    },
    note: "Total equals the Collected card. Split payments are allocated per method."
  },

  gamePerformance: {
    rows: [
      { game: "Pool", sessionsCount: 310, revenue: 78400, avgPerSession: 253, sharePct: 42.5 },
      { game: "Snooker", sessionsCount: 142, revenue: 41200, avgPerSession: 290, sharePct: 22.4 },
      { game: "PS5", sessionsCount: 75, revenue: 12000, avgPerSession: 160, sharePct: 6.5 },
      { game: "Mini-snooker", sessionsCount: 61, revenue: 9760, avgPerSession: 160, sharePct: 5.3 }
    ],
    sessionRevenueTotal: 141360,
    fbRevenueTotal: 42900,
    totalRevenue: 184260,
    note: "Session revenue ₹1,41,360 + F&B ₹42,900 = ₹1,84,260. Each counted once."
  },

  duesAndQKhata: {
    outstandingTotal: 14420,
    topDebtors: [
      { customerId: "d1", customerName: "Amit", phone: null, balance: 4200, oldestDays: 12 },
      { customerId: "d2", customerName: "Vikram", phone: null, balance: 3150, oldestDays: 6 },
      { customerId: "d3", customerName: "Table 4 regulars", phone: null, balance: 2300, oldestDays: 3 }
    ],
    rollForward: {
      openingDues: 16100,
      newDues: 38220,
      settledCollections: 39900,
      closingDues: 14420,
      equationLabel: "Opening ₹16,100 + new ₹38,220 – settled ₹39,900 = closing ₹14,420."
    }
  },

  reconciliation: {
    passed: true,
    checksPassed: 7,
    totalChecks: 7,
    details: [
      { code: "RULE_A", name: "Payment Methods Sum", passed: true, difference: 0, explanation: "Sum of per-method collections (₹1,69,840) exactly equals headline collected." },
      { code: "RULE_B", name: "Split Payment Allocation", passed: true, difference: 0, explanation: "Split payments allocate each portion to its method; no duplicate sessions." },
      { code: "RULE_C", name: "Revenue Composition", passed: true, difference: 0, explanation: "Session revenue ₹1,41,360 + F&B ₹42,900 = ₹1,84,260." },
      { code: "RULE_D", name: "Dues Roll-Forward Integrity", passed: true, difference: 0, explanation: "Opening ₹16,100 + new ₹38,220 – settled ₹39,900 = closing ₹14,420." },
      { code: "RULE_E", name: "Drill-Down Row Sum Integrity", passed: true, difference: 0, explanation: "Constituent rows sum identically to headline numbers." },
      { code: "RULE_F", name: "Transaction Table Consistency", passed: true, difference: 0, explanation: "Transactions sum for filter equals the summary card." },
      { code: "RULE_G", name: "Multi-Endpoint Invariant", passed: true, difference: 0, explanation: "Summary and trends return identical totals for the period." }
    ]
  }
};

export const mockReportsTransactions = {
  transactions: [
    { id: "tx-1", ref: "S-2041", type: "Session", time: "8:41 pm", date: "14 Oct", timestamp: Date.now() - 100000, customer: "Rahul", table: "T1", game: "Pool", method: "UPI", gross: 420, discount: 50, net: 370, status: "Paid", recordTrail: { payments: [{ payment_method: "UPI", amount: 370 }] } },
    { id: "tx-2", ref: "O-0877", type: "F&B", time: "8:12 pm", date: "14 Oct", timestamp: Date.now() - 200000, customer: "Walk-in", table: "T2", game: "F&B", method: "Cash", gross: 180, discount: 0, net: 180, status: "Paid", recordTrail: { payments: [{ payment_method: "Cash", amount: 180 }] } },
    { id: "tx-3", ref: "S-2038", type: "Session", time: "7:55 pm", date: "14 Oct", timestamp: Date.now() - 300000, customer: "Sneha", table: "VIP1", game: "Snooker", method: "UPI + Cash", gross: 640, discount: 40, net: 600, status: "Paid", recordTrail: { payments: [{ payment_method: "UPI", amount: 300, metadata: { split: true } }, { payment_method: "Cash", amount: 300, metadata: { split: true } }] } },
    { id: "tx-4", ref: "S-2034", type: "Session", time: "7:20 pm", date: "14 Oct", timestamp: Date.now() - 400000, customer: "Amit", table: "T3", game: "Pool", method: "QKhata", gross: 300, discount: 0, net: 300, status: "Due", recordTrail: { payments: [] } },
    { id: "tx-5", ref: "S-2031", type: "Refund", time: "6:48 pm", date: "14 Oct", timestamp: Date.now() - 500000, customer: "Walk-in", table: "T2", game: "Order Void", method: "UPI", gross: -150, discount: 0, net: -150, status: "Refunded", recordTrail: { payments: [{ payment_method: "UPI", amount: 150 }] } }
  ],
  pagination: { page: 1, pageSize: 10, totalCount: 5, totalPages: 1 },
  filteredTotals: { gross: 1390, net: 1300 }
};

