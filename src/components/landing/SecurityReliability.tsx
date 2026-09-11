import ScrollReveal from '@/components/ui/ScrollReveal';

export default function SecurityReliability() {
  const points = [
    {
      title: 'Data Isolation',
      description: 'Multi-tenant architecture ensures your business data is strictly isolated and never accessible by other venues.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    },
    {
      title: 'Cloud Infrastructure',
      description: 'Built on Supabase and Vercel, providing enterprise-grade availability and automated scaling for peak weekend traffic.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    },
    {
      title: 'Continuous Backups',
      description: 'Your QKhata ledgers, session histories, and member lists are persistently stored and automatically backed up.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-base border-t border-border-light">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="max-w-3xl mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Secure, reliable, and always online.
          </h2>
          <p className="text-text-secondary text-lg">
            We understand that if the system goes down, your business stops. We engineered Qcontrol to be resilient, secure, and fast.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {points.map((point, idx) => (
          <ScrollReveal key={idx} animation="fade-up" delay={idx * 200}>
            <div className="border-l-2 border-border-light pl-6 hover:border-accent transition-colors duration-300 h-full py-2">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-theme flex items-center justify-center text-text-primary mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {point.icon}
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">{point.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{point.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
