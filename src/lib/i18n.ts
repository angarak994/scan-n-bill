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
    tg_session_ended: "Session Ended Successfully"
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
    tg_session_ended: "सत्र सफलतापूर्वक समाप्त हुआ"
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
    tg_session_ended: "सत्र यशस्वीरीत्या पूर्ण झाले"
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
