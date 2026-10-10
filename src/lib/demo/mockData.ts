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
