import ScrollReveal from '@/components/ui/ScrollReveal';

export default function Integrations() {
  const platforms = [
    { name: 'WhatsApp', icon: '💬' },
    { name: 'Telegram', icon: '✈️' },
    { name: 'SMS', icon: '📱' },
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 text-center border-b border-border-light">
      <ScrollReveal animation="fade-up" delay={0}>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
          Connects with your customers&apos; favorite apps
        </h2>
        <p className="text-text-secondary mb-10 max-w-2xl mx-auto">
          Allow customers to book tables and receive alerts directly on the messaging platforms they already use daily.
        </p>
      </ScrollReveal>
      
      <div className="flex flex-wrap justify-center gap-6 sm:gap-12 items-center">
        {platforms.map((platform, idx) => (
          <ScrollReveal key={idx} animation="fade-in" delay={idx * 150}>
            <div className="flex items-center gap-3 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100 cursor-default hover-lift">
              <span className="text-3xl sm:text-4xl">{platform.icon}</span>
              <span className="text-lg font-bold text-text-primary">{platform.name}</span>
            </div>
          </ScrollReveal>
        ))}
        <ScrollReveal animation="fade-in" delay={450}>
          <div className="flex items-center gap-3 opacity-40">
            <span className="text-sm font-bold uppercase tracking-widest bg-bg-surface px-3 py-1 rounded-full border border-border-light">More coming soon</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
