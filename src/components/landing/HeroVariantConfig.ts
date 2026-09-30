export interface HeroVariant {
  id: string;
  headline: string;
  subline: string;
  requiredCapability: string; // The truth matrix row it depends on
}

export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: "flagship",
    headline: "Run your club. Not your spreadsheets.",
    subline: "Tables, sessions, billing, members and promotions in one live system.",
    requiredCapability: "core_system"
  },
  {
    id: "unified",
    headline: "Run your gaming business smarter.",
    subline: "Every table, session and rupee in one connected system.",
    requiredCapability: "core_system"
  },
  {
    id: "visibility",
    headline: "Every table. Every session. Every rupee.",
    subline: "See what's running, what's billed and what's earned, live.",
    requiredCapability: "core_system"
  },
  {
    id: "time-based",
    headline: "Your club runs by the hour. So should your software.",
    subline: "Time-based billing and promotions built for pool, snooker and PS5 clubs.",
    requiredCapability: "billing_engine"
  },
  {
    id: "journey",
    headline: "From first frame to final bill.",
    subline: "Start sessions by QR, track time live and bill automatically.",
    requiredCapability: "qr_sessions"
  },
  {
    id: "promotions",
    headline: "Promotions that start and end on time.",
    subline: "Set the window once. The price applies only while it is active.",
    requiredCapability: "time_window_promotions"
  },
  {
    id: "digital",
    headline: "Close the notebook. Open QControl.",
    subline: "Replace paper notes and spreadsheets with live session tracking.",
    requiredCapability: "core_system"
  },
  {
    id: "status",
    headline: "Know your club before you walk in.",
    subline: "Live table status on your dashboard and on Telegram.",
    requiredCapability: "live_status_telegram"
  },
  {
    id: "remote",
    headline: "Your phone is the control room.",
    subline: "Start, pause and stop tables from Telegram.",
    requiredCapability: "telegram_control"
  },
  {
    id: "automation",
    headline: "Less paperwork. More play.",
    subline: "Session tracking, billing and reports that handle themselves.",
    requiredCapability: "core_system"
  }
];
