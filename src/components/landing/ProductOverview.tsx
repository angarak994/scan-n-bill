import ScrollReveal from '@/components/ui/ScrollReveal';

export default function ProductOverview() {
  const modules = [
    {
      title: 'Dashboard',
      description: 'Get a bird\'s-eye view of your entire venue\'s real-time performance.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    },
    {
      title: 'Live Sessions',
      description: 'Monitor active tables, remaining times, and running costs instantly.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    },
    {
      title: 'QR Sessions',
      description: 'Empower players to scan, start, and manage their own table time.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    },
    {
      title: 'Bookings',
      description: 'Prevent double-bookings with a unified, conflict-free calendar.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    },
    {
      title: 'Members',
      description: 'Build loyalty with detailed player profiles and customized tiers.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    },
    {
      title: 'QKhata',
      description: 'Digitize your ledger for seamless credit and balance tracking.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
    },
    {
      title: 'Payments',
      description: 'Capture revenue securely with flexible, integrated checkout options.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    },
    {
      title: 'Reports',
      description: 'Make data-driven decisions using comprehensive venue analytics.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    },
    {
      title: 'Food & Beverages',
      description: 'Let players order snacks directly to their table via QR menus.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M6.75 13H17.25C18.2165 13 19 12.2165 19 11.25V11.25C19 10.2835 18.2165 9.5 17.25 9.5H6.75C5.7835 9.5 5 10.2835 5 11.25V11.25C5 12.2165 5.7835 13 6.75 13Z" />
    },
    {
      title: 'Telegram & WhatsApp',
      description: 'Engage customers instantly on the messaging apps they already use.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    },
    {
      title: 'Qpulse',
      description: 'Trigger real-time alerts and notifications across your venue ecosystem.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
    },
    {
      title: 'AI Business Assistant',
      description: 'Consult your personal data analyst for actionable revenue strategies.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    }
  ];

  return (
    <section id="product" className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-primary">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Everything you need, built in.
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl">
            A modular ecosystem designed specifically for the complexities of modern gaming lounges and billiards clubs.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {modules.map((module, index) => (
          <ScrollReveal key={index} animation="fade-up" delay={(index % 4) * 100}>
            <div className="bg-bg-surface p-6 rounded-xl border border-border-light hover:border-border-theme transition-all group h-full">
              <div className="w-10 h-10 rounded-lg bg-bg-card border border-border-light flex items-center justify-center text-text-primary mb-4 group-hover:scale-110 group-hover:text-accent transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {module.icon}
                </svg>
              </div>
              <h4 className="font-bold text-text-primary mb-2">{module.title}</h4>
              <p className="text-text-secondary text-sm leading-relaxed">{module.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
