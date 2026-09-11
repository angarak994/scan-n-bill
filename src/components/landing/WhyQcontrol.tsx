import ScrollReveal from '@/components/ui/ScrollReveal';

export default function WhyQcontrol() {
  const problems = [
    {
      problem: 'Manual Session Tracking',
      solution: 'QR Smart Timers auto-track usage to the minute, eliminating pen-and-paper errors.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    },
    {
      problem: 'Booking Confusion',
      solution: 'Centralized live calendar syncs walk-ins, phone calls, and WhatsApp reservations.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    },
    {
      problem: 'Payment Tracking',
      solution: 'Automated invoices and direct integration ensure every session is paid for securely.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    },
    {
      problem: 'QKhata Management',
      solution: 'Digital ledgers seamlessly manage member balances, credits, and outstanding dues.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    },
    {
      problem: 'Fragmented Channels',
      solution: 'Unified inbox handles WhatsApp, Telegram, and SMS directly from the dashboard.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    },
    {
      problem: 'Lack of Insight',
      solution: 'AI Business Assistant analyzes utilization to recommend pricing and peak optimizations.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-border-light">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Why Qcontrol?
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
            We replaced manual guesswork with automated precision, giving you back control of your venue.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {problems.map((item, index) => (
          <ScrollReveal key={index} animation="fade-up" delay={index * 100}>
            <div className="bg-bg-surface border border-border-theme p-6 sm:p-8 rounded-2xl hover-lift h-full">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 text-text-primary">
                <span className="text-text-disabled line-through text-sm block mb-1 font-normal">{item.problem}</span>
                {item.solution.split(' ')[0]} {item.solution.split(' ')[1]}
              </h3>
              <p className="text-text-secondary leading-relaxed">
                {item.solution}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
