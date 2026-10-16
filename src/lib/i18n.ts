export type SupportedLanguage = 'en' | 'hi' | 'mr';

export interface Translations {
  // Navigation & Common
  dashboard: string;
  tables: string;
  active_sessions: string;
  bookings: string;
  members: string;
  qkhata: string;
  reports: string;
  settings: string;
  pricing: string;
  search: string;
  filter: string;
  actions: string;
  status: string;
  save: string;
  cancel: string;
  confirm: string;
  back: string;
  close: string;
  loading: string;
  refresh: string;
  language: string;

  // Tables & Sessions
  table: string;
  game_type: string;
  rate: string;
  available: string;
  occupied: string;
  paused: string;
  reserved: string;
  start_session: string;
  end_session: string;
  pause_session: string;
  resume_session: string;
  customer_name: string;
  duration: string;
  cost: string;
  food_cost: string;
  total_cost: string;
  amount_paid: string;
  discount: string;
  payment_method: string;
  settle_bill: string;
  paid: string;
  pending: string;
  partially_paid: string;

  // Members & QKhata
  member_directory: string;
  add_member: string;
  member_name: string;
  phone_number: string;
  tier: string;
  total_spend: string;
  loyalty_points: string;
  expiry_date: string;
  no_members_found: string;
  outstanding_balance: string;
  members_pending: string;
  settle_full: string;
  partial_payment: string;
  add_charge: string;
  clear_balance: string;
  qkhata_collections: string;
  no_outstanding_balance: string;
  total_outstanding: string;
  active_debtors: string;
  overdue_accounts: string;
  select_member_ledger: string;
  record_payment: string;
  settle_balance: string;
  current_balance: string;
  no_transactions_found: string;
  credit_billed: string;
  debit_paid: string;
  balance: string;
  remind: string;

  // Telegram Menu
  tg_start_session: string;
  tg_active_sessions: string;
  tg_member_qkhata: string;
  tg_stop_session: string;
  tg_book_table: string;
  tg_paused_sessions: string;
  tg_today_summary: string;
  tg_switch_business: string;
  tg_change_language: string;
  tg_welcome: string;
  tg_choose_action: string;
  tg_session_started: string;
  tg_session_ended: string;

  // New Session Modal
  new_session: string;
  new_session_subtitle: string;
  lazy_mode: string;
  instant_start: string;
  select_member: string;
  change_member: string;
  walkin_placeholder: string;
  search_member_placeholder: string;
  only_members_qkhata: string;
  overdue: string;
  select_table: string;
  choose_table: string;
  no_available_tables: string;
  choose_game: string;
  no_game_types: string;
  quick_guest_start: string;
  players: string;
  player_1: string;
  player_2: string;
  player_3: string;
  player_4: string;
  custom_start_time: string;
  session_notes: string;
  notes_placeholder: string;
  playing_on_qkhata: string;
  starting: string;

  // Table View & Cards
  layout: string;
  standard: string;
  premium: string;
  live_active_tables: string;
  total_open: string;
  client: string;
  timer: string;
  amount: string;
  all_units: string;
  live: string;
  session_elapsed: string;
  table_fee: string;
  fb_orders: string;
  quick_add: string;
  bill: string;
  start: string;
  reserve: string;
  transfer: string;
  double_click_rename: string;
  no_tables_found: string;
  no_tables_desc: string;
  business_ready_empty: string;
  completed_sessions: string;
  running_total: string;
  add_to_session: string;

  // End Session & Settlement Modal
  end_session_title: string;
  finalize_bill_for: string;
  split_bill: string;
  no_split: string;
  ways: string;
  per_person: string;
  pay_now: string;
  play_on_credit: string;
  amount_received: string;
  amount_received_desc: string;
  cash: string;
  upi: string;
  card: string;
  other: string;
  cash_tendered: string;
  exact_amount: string;
  change_due: string;
  due_date: string;
  use_next_cycle: string;
  due_date_qkhata_hint: string;
  confirm_qkhata: string;
  confirm_and_end: string;

  // Overview & KPIs
  daily_revenue: string;
  active_tables: string;
  sessions: string;
  goal: string;
  achieved: string;
  remaining_to_reach: string;
  daily_target_achieved: string;
  no_target_set: string;
  tables_available_ready: string;
  avg_duration: string;
  finished: string;
  upcoming_bookings: string;
  schedule_booking_empty: string;
  live_food_orders: string;
  no_food_orders: string;
  delete_food_order: string;
  confirm_delete_food_order_title: string;
  confirm_delete_food_order_desc: string;
  order_deleted_success: string;
  deleting_order: string;

  // Bookings Modal
  new_booking: string;
  schedule_booking: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  duration_mins: string;
  confirm_booking: string;
  no_show: string;

  // Topbar & Common
  store_open: string;
  store_closed: string;
  logout: string;
  logout_confirm: string;
  quick_actions: string;
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    // Navigation & Common
    dashboard: "Dashboard",
    tables: "Tables",
    active_sessions: "Active Sessions",
    bookings: "Bookings",
    members: "Members",
    qkhata: "QKhata",
    reports: "Reports & KPIs",
    settings: "Settings",
    pricing: "Pricing",
    search: "Search...",
    filter: "Filter",
    actions: "Actions",
    status: "Status",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    close: "Close",
    loading: "Loading...",
    refresh: "Refresh",
    language: "Language",

    // Tables & Sessions
    table: "Table",
    game_type: "Game Type",
    rate: "Rate",
    available: "Available",
    occupied: "Occupied",
    paused: "Paused",
    reserved: "Reserved",
    start_session: "Start Session",
    end_session: "End Session",
    pause_session: "Pause",
    resume_session: "Resume",
    customer_name: "Customer Name",
    duration: "Duration",
    cost: "Cost",
    food_cost: "Food & Drinks",
    total_cost: "Total Bill",
    amount_paid: "Amount Paid",
    discount: "Discount",
    payment_method: "Payment Method",
    settle_bill: "Settle Bill",
    paid: "Paid",
    pending: "Pending",
    partially_paid: "Partially Paid",

    // Members & QKhata
    member_directory: "Member Directory",
    add_member: "Add Member",
    member_name: "Member Name",
    phone_number: "Phone Number",
    tier: "Tier",
    total_spend: "Total Spend",
    loyalty_points: "Points",
    expiry_date: "Expiry Date",
    no_members_found: "No members found",
    outstanding_balance: "Outstanding Balance",
    members_pending: "Members Pending",
    settle_full: "Settle Full",
    partial_payment: "Partial Payment",
    add_charge: "Add Charge",
    clear_balance: "Clear Balance",
    qkhata_collections: "Member QKhata Collections",
    no_outstanding_balance: "No outstanding balances found for registered members!",
    total_outstanding: "Total Outstanding",
    active_debtors: "Active Debtors",
    overdue_accounts: "Overdue Accounts",
    select_member_ledger: "Select a member to view ledger",
    record_payment: "Record Payment",
    settle_balance: "Settle Balance",
    current_balance: "Current Balance",
    no_transactions_found: "No transactions found",
    credit_billed: "Credit (Billed)",
    debit_paid: "Debit (Paid)",
    balance: "Balance",
    remind: "Remind",

    // Telegram Menu
    tg_start_session: "▶️ Start Session",
    tg_active_sessions: "📋 Active Sessions",
    tg_member_qkhata: "📒 Member QKhata",
    tg_stop_session: "🛑 Stop Session",
    tg_book_table: "📅 Book Table",
    tg_paused_sessions: "⏸ Paused Sessions",
    tg_today_summary: "💰 Today's Summary",
    tg_switch_business: "🏢 Switch Business",
    tg_change_language: "🌐 Language / भाषा",
    tg_welcome: "Welcome to QControl.",
    tg_choose_action: "Please choose an action:",
    tg_session_started: "Session Started Successfully",
    tg_session_ended: "Session Ended Successfully",

    // New Session Modal
    new_session: "New Session",
    new_session_subtitle: "Start a session for walk-ins without QR.",
    lazy_mode: "Lazy Mode",
    instant_start: "Instant Start",
    select_member: "Select Member",
    change_member: "Change Member",
    walkin_placeholder: "Walk-In or Member Name",
    search_member_placeholder: "Search registered member...",
    only_members_qkhata: "Only registered members can use QKhata.",
    overdue: "Overdue",
    select_table: "Select Table",
    choose_table: "-- Choose table --",
    no_available_tables: "No tables currently available",
    choose_game: "-- Choose game --",
    no_game_types: "No game types configured",
    quick_guest_start: "⚡ Quick Start (Guest)",
    players: "Players",
    player_1: "1 Player",
    player_2: "2 Players",
    player_3: "3 Players",
    player_4: "4 Players",
    custom_start_time: "Custom Start Time (Optional)",
    session_notes: "Session Notes (Optional)",
    notes_placeholder: "Special requests...",
    playing_on_qkhata: "Playing on QKhata",
    starting: "Starting...",

    // Table View & Cards
    layout: "Layout",
    standard: "Standard",
    premium: "Premium",
    live_active_tables: "Live Active Tables",
    total_open: "Total Open",
    client: "Client",
    timer: "Timer",
    amount: "Amount",
    all_units: "All Units",
    live: "Live",
    session_elapsed: "Session Elapsed",
    table_fee: "Table Fee",
    fb_orders: "F&B Orders",
    quick_add: "+ Quick Add",
    bill: "BILL",
    start: "Start",
    reserve: "Reserve",
    transfer: "Transfer",
    double_click_rename: "Double click to rename",
    no_tables_found: "No tables found",
    no_tables_desc: "Try adjusting your filters or add a new unit from settings.",
    business_ready_empty: "Your business is ready. Assign a customer to a table to start tracking.",
    completed_sessions: "Completed Sessions",
    running_total: "Running Total",
    add_to_session: "ADD TO SESSION",

    // End Session & Settlement Modal
    end_session_title: "End Session",
    finalize_bill_for: "Finalize bill for",
    split_bill: "Split Bill",
    no_split: "No",
    ways: "Ways",
    per_person: "per person",
    pay_now: "Pay Now",
    play_on_credit: "Play on Credit (QKhata)",
    amount_received: "Amount Received (₹)",
    amount_received_desc: "Edit this if the customer is paying a different amount. The remaining balance goes to QKhata.",
    cash: "Cash",
    upi: "UPI",
    card: "Card",
    other: "Other",
    cash_tendered: "Cash Tendered (₹)",
    exact_amount: "Exact Amount",
    change_due: "Change Due",
    due_date: "Due Date",
    use_next_cycle: "+ Use Next Billing Cycle / Registration Date",
    due_date_qkhata_hint: "This will add to their outstanding QKhata balance.",
    confirm_qkhata: "Confirm QKhata",
    confirm_and_end: "Confirm & End",

    // Overview & KPIs
    daily_revenue: "Daily Revenue",
    active_tables: "Active Tables",
    sessions: "Sessions",
    goal: "Goal",
    achieved: "Achieved",
    remaining_to_reach: "remaining to reach today's target",
    daily_target_achieved: "Daily target achieved!",
    no_target_set: "No daily target set",
    tables_available_ready: "Tables available and ready",
    avg_duration: "Avg.",
    finished: "finished",
    upcoming_bookings: "Upcoming Bookings",
    schedule_booking_empty: "Ready to grow your business? Schedule your first booking today.",
    live_food_orders: "Live Food Orders",
    no_food_orders: "No active food orders. Orders placed via QR menu will appear here.",
    delete_food_order: "Delete Order",
    confirm_delete_food_order_title: "Delete Food Order",
    confirm_delete_food_order_desc: "Are you sure you want to delete this food order? The order cost will be deducted from the table session.",
    order_deleted_success: "Food order deleted successfully",
    deleting_order: "Deleting order...",

    // Bookings Modal
    new_booking: "New Booking",
    schedule_booking: "Schedule Booking",
    customer_phone: "Customer Phone",
    booking_date: "Booking Date",
    booking_time: "Booking Time",
    duration_mins: "Duration (minutes)",
    confirm_booking: "Confirm Booking",
    no_show: "No Show",

    // Topbar & Common
    store_open: "Open",
    store_closed: "Closed",
    logout: "Logout",
    logout_confirm: "Are you sure you want to log out?",
    quick_actions: "Quick Actions"
  },

  hi: {
    // Navigation & Common
    dashboard: "डैशबोर्ड",
    tables: "टेबल्स",
    active_sessions: "सक्रिय सत्र",
    bookings: "बुकिंग",
    members: "सदस्य",
    qkhata: "क्यू-खाता",
    reports: "रिपोर्ट्स",
    settings: "सेटिंग्स",
    pricing: "दर सूची",
    search: "खोजें...",
    filter: "फ़िल्टर",
    actions: "कार्य",
    status: "स्थिति",
    save: "सहेजें",
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    back: "वापस",
    close: "बंद करें",
    loading: "लोड हो रहा है...",
    refresh: "ताज़ा करें",
    language: "भाषा",

    // Tables & Sessions
    table: "टेबल",
    game_type: "खेल का प्रकार",
    rate: "दर",
    available: "उपलब्ध",
    occupied: "व्यस्त",
    paused: "रुका हुआ",
    reserved: "आरक्षित",
    start_session: "सत्र शुरू करें",
    end_session: "सत्र समाप्त करें",
    pause_session: "रोकें",
    resume_session: "पुनः शुरू करें",
    customer_name: "ग्राहक का नाम",
    duration: "अवधि",
    cost: "लागत",
    food_cost: "नाश्ता व पेय",
    total_cost: "कुल बिल",
    amount_paid: "भुगतान राशि",
    discount: "छूट",
    payment_method: "भुगतान विधि",
    settle_bill: "बिल चुकता करें",
    paid: "भुगतान हुआ",
    pending: "बाकी",
    partially_paid: "आंशिक भुगतान",

    // Members & QKhata
    member_directory: "सदस्य सूची",
    add_member: "नया सदस्य जोड़ें",
    member_name: "सदस्य का नाम",
    phone_number: "फ़ोन नंबर",
    tier: "श्रेणी",
    total_spend: "कुल खर्च",
    loyalty_points: "अंक",
    expiry_date: "समाप्ति तिथि",
    no_members_found: "कोई सदस्य नहीं मिला",
    outstanding_balance: "बकाया राशि",
    members_pending: "लंबित सदस्य",
    settle_full: "पूर्ण निपटान",
    partial_payment: "आंशिक भुगतान",
    add_charge: "शुल्क जोड़ें",
    clear_balance: "खाता साफ़ करें",
    qkhata_collections: "सदस्य खाता संग्रह",
    no_outstanding_balance: "पंजीकृत सदस्यों का कोई बकाया नहीं है!",
    total_outstanding: "कुल बकाया",
    active_debtors: "सक्रिय बकायेदार",
    overdue_accounts: "अतिदेय खाते",
    select_member_ledger: "खाता देखने के लिए सदस्य चुनें",
    record_payment: "भुगतान दर्ज करें",
    settle_balance: "बकाया चुकाएं",
    current_balance: "वर्तमान बकाया",
    no_transactions_found: "कोई लेन-देन नहीं मिला",
    credit_billed: "उधार (बिल)",
    debit_paid: "जमा (भुगतान)",
    balance: "शेष राशि",
    remind: "याद दिलाएं",

    // Telegram Menu
    tg_start_session: "▶️ सत्र शुरू करें",
    tg_active_sessions: "📋 सक्रिय सत्र",
    tg_member_qkhata: "📒 सदस्य खाता",
    tg_stop_session: "🛑 सत्र समाप्त करें",
    tg_book_table: "📅 टेबल बुक करें",
    tg_paused_sessions: "⏸ रुके हुए सत्र",
    tg_today_summary: "💰 आज का सारांश",
    tg_switch_business: "🏢 व्यवसाय बदलें",
    tg_change_language: "🌐 भाषा बदलें",
    tg_welcome: "क्यू-कंट्रोल में आपका स्वागत है।",
    tg_choose_action: "कृपया एक विकल्प चुनें:",
    tg_session_started: "सत्र सफलतापूर्वक शुरू हुआ",
    tg_session_ended: "सत्र सफलतापूर्वक समाप्त हुआ",

    // New Session Modal
    new_session: "नया सत्र",
    new_session_subtitle: "बिना क्यूआर वॉक-इन ग्राहकों के लिए सत्र शुरू करें।",
    lazy_mode: "त्वरित मोड",
    instant_start: "त्वरित शुरुआत",
    select_member: "सदस्य चुनें",
    change_member: "सदस्य बदलें",
    walkin_placeholder: "वॉक-इन या सदस्य का नाम",
    search_member_placeholder: "पंजीकृत सदस्य खोजें...",
    only_members_qkhata: "केवल पंजीकृत सदस्य ही क्यू-खाता का उपयोग कर सकते हैं।",
    overdue: "अतिदेय",
    select_table: "टेबल चुनें",
    choose_table: "-- टेबल चुनें --",
    no_available_tables: "कोई टेबल उपलब्ध नहीं है",
    choose_game: "-- गेम चुनें --",
    no_game_types: "कोई गेम कॉन्फ़िगर नहीं है",
    quick_guest_start: "⚡ त्वरित शुरुआत (अतिथि)",
    players: "खिलाड़ी",
    player_1: "1 खिलाड़ी",
    player_2: "2 खिलाड़ी",
    player_3: "3 खिलाड़ी",
    player_4: "4 खिलाड़ी",
    custom_start_time: "सत्र शुरू करने का समय (वैकल्पिक)",
    session_notes: "सत्र नोट्स (वैकल्पिक)",
    notes_placeholder: "विशेष विवरण या अनुरोध...",
    playing_on_qkhata: "क्यू-खाता पर चालू है",
    starting: "शुरू हो रहा है...",

    // Table View & Cards
    layout: "लेआउट",
    standard: "मानक",
    premium: "प्रीमियम",
    live_active_tables: "सक्रिय टेबल्स",
    total_open: "कुल चालू",
    client: "ग्राहक",
    timer: "समय / टाइमर",
    amount: "रकम",
    all_units: "कुल यूनिट्स",
    live: "लाइव",
    session_elapsed: "सत्र अवधि",
    table_fee: "टेबल शुल्क",
    fb_orders: "नाश्ता व पेय ऑर्डर्स",
    quick_add: "+ नाश्ता जोड़ें",
    bill: "बिल करें",
    start: "शुरू करें",
    reserve: "आरक्षित करें",
    transfer: "ट्रांसफर",
    double_click_rename: "नाम बदलने के लिए दो बार क्लिक करें",
    no_tables_found: "कोई टेबल नहीं मिली",
    no_tables_desc: "फ़िल्टर बदलें या सेटिंग्स से नई टेबल जोड़ें।",
    business_ready_empty: "आपका व्यवसाय तैयार है। शुरू करने के लिए किसी ग्राहक को टेबल सौंपें।",
    completed_sessions: "पूर्ण सत्र",
    running_total: "कुल जोड़",
    add_to_session: "बिल में जोड़ें",

    // End Session & Settlement Modal
    end_session_title: "सत्र समाप्त करें",
    finalize_bill_for: "बिल तैयार करें:",
    split_bill: "बिल बांटें",
    no_split: "नहीं",
    ways: "हिस्से",
    per_person: "प्रति व्यक्ति",
    pay_now: "तुरंत भुगतान",
    play_on_credit: "उधार पर खेलें (क्यू-खाता)",
    amount_received: "प्राप्त राशि (₹)",
    amount_received_desc: "यदि ग्राहक अलग राशि दे रहा है तो बदलें। शेष राशि क्यू-खाता में जाएगी।",
    cash: "नकद",
    upi: "यूपीआई",
    card: "कार्ड",
    other: "अन्य",
    cash_tendered: "दी गई नकद राशि (₹)",
    exact_amount: "सटीक राशि",
    change_due: "वापसी राशि",
    due_date: "अंतिम देय तिथि",
    use_next_cycle: "+ अगला बिलिंग चक्र / पंजीकरण तिथि",
    due_date_qkhata_hint: "यह राशि उनके बकाया क्यू-खाते में जुड़ जाएगी।",
    confirm_qkhata: "क्यू-खाता में दर्ज करें",
    confirm_and_end: "पुष्टि करें और समाप्त करें",

    // Overview & KPIs
    daily_revenue: "दैनिक आय",
    active_tables: "सक्रिय टेबल्स",
    sessions: "सत्र",
    goal: "लक्ष्य",
    achieved: "प्राप्त हुआ",
    remaining_to_reach: "आज का लक्ष्य प्राप्त करने के लिए शेष",
    daily_target_achieved: "दैनिक लक्ष्य प्राप्त हुआ!",
    no_target_set: "दैनिक लक्ष्य सेट नहीं है",
    tables_available_ready: "टेबल्स उपलब्ध और तैयार हैं",
    avg_duration: "औसत",
    finished: "पूर्ण",
    upcoming_bookings: "आगामी बुकिंग्स",
    schedule_booking_empty: "व्यापार बढ़ाने के लिए आज ही अपनी पहली बुकिंग शेड्यूल करें।",
    live_food_orders: "लाइव फ़ूड ऑर्डर्स",
    no_food_orders: "कोई सक्रिय फ़ूड ऑर्डर नहीं है। क्यूआर मेनू से दिए गए ऑर्डर यहाँ दिखेंगे।",
    delete_food_order: "ऑर्डर हटाएं",
    confirm_delete_food_order_title: "फ़ूड ऑर्डर हटाएं",
    confirm_delete_food_order_desc: "क्या आप वाकई यह फ़ूड ऑर्डर हटाना चाहते हैं? ऑर्डर की राशि टेबल सत्र से घटा दी जाएगी।",
    order_deleted_success: "फ़ूड ऑर्डर सफलतापूर्वक हटा दिया गया",
    deleting_order: "ऑर्डर हटाया जा रहा है...",

    // Bookings Modal
    new_booking: "नई बुकिंग",
    schedule_booking: "बुकिंग शेड्यूल करें",
    customer_phone: "ग्राहक का फ़ोन नंबर",
    booking_date: "बुकिंग तिथि",
    booking_time: "बुकिंग समय",
    duration_mins: "अवधि (मिनट)",
    confirm_booking: "बुकिंग पक्की करें",
    no_show: "उपस्थित नहीं",

    // Topbar & Common
    store_open: "खुला है",
    store_closed: "बंद है",
    logout: "लॉग आउट",
    logout_confirm: "क्या आप वाकई लॉग आउट करना चाहते हैं?",
    quick_actions: "त्वरित कार्य"
  },

  mr: {
    // Navigation & Common
    dashboard: "डॅशबोर्ड",
    tables: "टेबल्स",
    active_sessions: "चालू सत्रे",
    bookings: "बुकिंग्ज",
    members: "सभासद",
    qkhata: "क्यू-खाते",
    reports: "अहवाल व आकडेवारी",
    settings: "सेटिंग्ज",
    pricing: "दरपत्रक",
    search: "शोधा...",
    filter: "फिल्टर",
    actions: "कृती",
    status: "स्थिती",
    save: "जतन करा",
    cancel: "रद्द करा",
    confirm: "नक्की करा",
    back: "मागे",
    close: "बंद करा",
    loading: "लोड होत आहे...",
    refresh: "रिफ्रेश",
    language: "भाषा",

    // Tables & Sessions
    table: "टेबल",
    game_type: "खेळाचा प्रकार",
    rate: "दर",
    available: "उपलब्ध",
    occupied: "सुरू",
    paused: "थांबवलेले",
    reserved: "आरक्षित",
    start_session: "सत्र सुरू करा",
    end_session: "सत्र थांबवा",
    pause_session: "विराम",
    resume_session: "पुन्हा सुरू करा",
    customer_name: "ग्राहकाचे नाव",
    duration: "कालावधी",
    cost: "खर्च",
    food_cost: "खाद्यपदार्थ व पेये",
    total_cost: "एकूण बिल",
    amount_paid: "दिलेली रक्कम",
    discount: "सूट",
    payment_method: "पेमेंट पद्धत",
    settle_bill: "बिल भरा",
    paid: "भरले",
    pending: "बाकी",
    partially_paid: "काही रक्कम भरली",

    // Members & QKhata
    member_directory: "सभासद यादी",
    add_member: "नवीन सभासद जोडा",
    member_name: "सभासदाचे नाव",
    phone_number: "मोबाईल नंबर",
    tier: "दर्जा",
    total_spend: "एकूण खर्च",
    loyalty_points: "गुण",
    expiry_date: "मुदत संपण्याची तारीख",
    no_members_found: "कोणताही सभासद सापडला नाही",
    outstanding_balance: "उधार / बाकी रक्कम",
    members_pending: "बाकी असलेले सभासद",
    settle_full: "पूर्ण हिशोब चुकता करा",
    partial_payment: "काही रक्कम जमा करा",
    add_charge: "खर्च जोडा",
    clear_balance: "खाते नील करा",
    qkhata_collections: "सभासद खाते वसुली",
    no_outstanding_balance: "नोंदणीकृत सभासदांची कोणतीही बाकी रक्कम नाही!",
    total_outstanding: "एकूण थकबाकी",
    active_debtors: "थकबाकीदार सभासद",
    overdue_accounts: "मुदत उलटलेली खाती",
    select_member_ledger: "खातेवही पाहण्यासाठी सभासद निवडा",
    record_payment: "जमा नोंदवा",
    settle_balance: "शिल्लक फेडा",
    current_balance: "सध्याची थकबाकी",
    no_transactions_found: "कोणतेही व्यवहार आढळले नाहीत",
    credit_billed: "नावे (बिल)",
    debit_paid: "जमा (भरलेले)",
    balance: "शिल्लक",
    remind: "आठवण करा",

    // Telegram Menu
    tg_start_session: "▶️ सत्र सुरू करा",
    tg_active_sessions: "📋 चालू सत्रे",
    tg_member_qkhata: "📒 सदस्य खाते",
    tg_stop_session: "🛑 सत्र थांबवा",
    tg_book_table: "📅 टेबल बुक करा",
    tg_paused_sessions: "⏸ थांबवलेले सत्रे",
    tg_today_summary: "💰 आजचा हिशोब",
    tg_switch_business: "🏢 व्यवसाय बदला",
    tg_change_language: "🌐 भाषा बदला",
    tg_welcome: "क्यु-कंट्रोल मध्ये आपले स्वागत आहे.",
    tg_choose_action: "कृपया पुढीलपैकी पर्याय निवडा:",
    tg_session_started: "सत्र यशस्वीरीत्या सुरू झाले",
    tg_session_ended: "सत्र यशस्वीरीत्या पूर्ण झाले",

    // New Session Modal
    new_session: "नवीन सत्र",
    new_session_subtitle: "क्यूआर शिवाय थेट आलेल्या ग्राहकांसाठी सत्र सुरू करा.",
    lazy_mode: "झटपट मोड",
    instant_start: "झटपट सुरू",
    select_member: "सभासद निवडा",
    change_member: "सभासद बदला",
    walkin_placeholder: "थेट ग्राहक किंवा सभासदाचे नाव",
    search_member_placeholder: "नोंदणीकृत सभासद शोधा...",
    only_members_qkhata: "फक्त नोंदणीकृत सभासदच क्यू-खाते वापरू शकतात.",
    overdue: "थकबाकी",
    select_table: "टेबल निवडा",
    choose_table: "-- टेबल निवडा --",
    no_available_tables: "सध्या कोणताही टेबल उपलब्ध नाही",
    choose_game: "-- खेळ निवडा --",
    no_game_types: "कोणतेही खेळ उपलब्ध नाहीत",
    quick_guest_start: "⚡ थेट सुरू करा (अतिथी)",
    players: "खेळाडू",
    player_1: "1 खेळाडू",
    player_2: "2 खेळाडू",
    player_3: "3 खेळाडू",
    player_4: "4 खेळाडू",
    custom_start_time: "सत्र सुरू करण्याची वेळ (पर्यायी)",
    session_notes: "सत्र नोंदी (पर्यायी)",
    notes_placeholder: "काही विशेष सूचना किंवा तपशील...",
    playing_on_qkhata: "क्यू-खात्यावर खेळत आहेत",
    starting: "सुरू होत आहे...",

    // Table View & Cards
    layout: "मांडणी",
    standard: "प्रमाणित",
    premium: "प्रीमियम",
    live_active_tables: "चालू टेबल्स",
    total_open: "एकूण चालू",
    client: "ग्राहक",
    timer: "वेळ / टाइमर",
    amount: "रक्कम",
    all_units: "एकूण युनिट्स",
    live: "चालू",
    session_elapsed: "सत्र वेळ",
    table_fee: "टेबल भाडे",
    fb_orders: "खाद्यपदार्थ व पेये ऑर्डर्स",
    quick_add: "+ खाद्यपदार्थ जोडा",
    bill: "बिल करा",
    start: "सुरू करा",
    reserve: "आरक्षित करा",
    transfer: "टेबल बदला",
    double_click_rename: "नाव बदलण्यासाठी दोनदा क्लिक करा",
    no_tables_found: "कोणतेही टेबल सापडले नाही",
    no_tables_desc: "फिल्टर तपासा किंवा सेटिंग्जमधून नवीन टेबल जोडा.",
    business_ready_empty: "तुमचा व्यवसाय तयार आहे. ग्राहकाला टेबल देऊन सत्र सुरू करा.",
    completed_sessions: "पूर्ण झालेली सत्रे",
    running_total: "एकूण बेरीज",
    add_to_session: "बिलात जोडा",

    // End Session & Settlement Modal
    end_session_title: "सत्र थांबवा / बिल करा",
    finalize_bill_for: "यांचे बिल पूर्ण करा:",
    split_bill: "बिल विभागणी",
    no_split: "नाही",
    ways: "भाग",
    per_person: "प्रत्येकी",
    pay_now: "आत्ताच भरा",
    play_on_credit: "उधारीवर (क्यू-खाते)",
    amount_received: "मिळालेली रक्कम (₹)",
    amount_received_desc: "ग्राहकाने वेगळी रक्कम दिल्यास येथे बदला. उरलेली रक्कम क्यू-खात्यात जमा होईल.",
    cash: "रोख",
    upi: "युपीआय",
    card: "कार्ड",
    other: "इतर",
    cash_tendered: "दिलेली रोख रक्कम (₹)",
    exact_amount: "तंतोतंत रक्कम",
    change_due: "परत द्यायची रक्कम",
    due_date: "देय तारीख",
    use_next_cycle: "+ पुढील बिलिंग चक्र / नोंदणी तारीख वापरा",
    due_date_qkhata_hint: "ही रक्कम त्यांच्या थकबाकी क्यू-खात्यात जमा होईल.",
    confirm_qkhata: "क्यू-खात्यात नोंदवा",
    confirm_and_end: "नक्की करा आणि बिल संपवा",

    // Overview & KPIs
    daily_revenue: "आजचे उत्पन्न",
    active_tables: "चालू टेबल्स",
    sessions: "एकूण सत्रे",
    goal: "ध्येय",
    achieved: "पूर्ण झाले",
    remaining_to_reach: "आजचे ध्येय गाठण्यासाठी शिल्लक",
    daily_target_achieved: "आजचे उद्दिष्ट साध्य झाले!",
    no_target_set: "दैनिक उद्दिष्ट ठरवलेले नाही",
    tables_available_ready: "टेबल्स रिकामे व सज्ज आहेत",
    avg_duration: "सरासरी",
    finished: "पूर्ण",
    upcoming_bookings: "पुढील बुकिंग्ज",
    schedule_booking_empty: "व्यवसाय वाढवण्यासाठी आजच पहिले बुकिंग नोंदवा.",
    live_food_orders: "चालू खाद्य ऑर्डर्स",
    no_food_orders: "कोणतीही चालू फूड ऑर्डर नाही. क्यूआर मेनूवरून दिलेल्या ऑर्डर्स येथे दिसतील.",
    delete_food_order: "ऑर्डर हटवा",
    confirm_delete_food_order_title: "खाद्य ऑर्डर हटवा",
    confirm_delete_food_order_desc: "तुम्हाला नक्की हा खाद्य ऑर्डर हटवायचा आहे का? ऑर्डरची रक्कम टेबल सत्रातून वजा केली जाईल.",
    order_deleted_success: "खाद्य ऑर्डर यशस्वीरित्या हटवला गेला",
    deleting_order: "ऑर्डर हटवत आहे...",

    // Bookings Modal
    new_booking: "नवीन बुकिंग",
    schedule_booking: "बुकिंग नोंदवा",
    customer_phone: "ग्राहकाचा फोन नंबर",
    booking_date: "बुकिंग तारीख",
    booking_time: "बुकिंग वेळ",
    duration_mins: "कालावधी (मिनिटे)",
    confirm_booking: "बुकिंग पक्की करा",
    no_show: "गैरहजर",

    // Topbar & Common
    store_open: "सुरू आहे",
    store_closed: "बंद आहे",
    logout: "लॉग आऊट",
    logout_confirm: "तुम्हाला नक्की लॉग आऊट करायचे आहे का?",
    quick_actions: "झटपट कृती"
  }
};

export function getTranslation(lang: SupportedLanguage = 'en', key: keyof Translations): string {
  const dictionary = translations[lang] || translations.en;
  return dictionary[key] || translations.en[key] || String(key);
}

export function t(lang: SupportedLanguage = 'en', key: keyof Translations, fallback?: string): string {
  const dictionary = translations[lang] || translations.en;
  return dictionary[key] || fallback || translations.en[key] || String(key);
}
