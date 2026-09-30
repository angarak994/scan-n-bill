export interface HeroVariant {
  id: string;
  headline: string;
  subline: string;
  eyebrow?: string;
}

export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: "flagship",
    headline: "Run your club. Not your spreadsheets.",
    subline: "Tables, sessions, billing, members, promotions, F&B and realtime control in one connected system.",
  },
  {
    id: "unified",
    headline: "Every table. Every session. Every rupee. One system.",
    subline: "See and bill everything the club does, live.",
  },
  {
    id: "time-based",
    headline: "Your club runs by the hour. So should your software.",
    subline: "Time-based billing and promotions built around how a billiards club actually works.",
  },
  {
    id: "visibility",
    headline: "Know what's happening at every table. Before you walk across the room.",
    subline: "Live table status on your dashboard and your phone.",
  },
  {
    id: "journey",
    headline: "From first break to final bill, QControl keeps the club moving.",
    subline: "QR sessions, live timers and automatic billing, start to finish.",
  },
  {
    id: "comprehensive",
    headline: "Run more of your club from one place.",
    subline: "Live tables. Accurate billing. QR sessions. Promotions. Owner controls. Reports.",
  },
  {
    id: "promotions",
    headline: "Promotions that start and stop on time. Every time.",
    subline: "Set the window once. QControl applies the price only while it's active.",
  },
  {
    id: "telegram",
    headline: "Your phone is now the control room.",
    subline: "Start, pause and stop tables from Telegram and watch the dashboard update.",
  }
];
