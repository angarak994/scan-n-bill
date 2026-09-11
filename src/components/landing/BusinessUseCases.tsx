import ScrollReveal from '@/components/ui/ScrollReveal';

export default function BusinessUseCases() {
  const cases = [
    {
      title: 'Billiards & Snooker Clubs',
      description: 'Manage table turnaround instantly. Track hourly rates automatically without disputes.',
      icon: '🎱'
    },
    {
      title: 'PS5 & Gaming Lounges',
      description: 'Pre-paid or post-paid console time tracking with food orders mapped directly to the screen.',
      icon: '🎮'
    },
    {
      title: 'Multi-Activity Venues',
      description: 'Handle different pricing structures for bowling lanes, arcade tokens, and pool tables in one dashboard.',
      icon: '🎳'
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-primary border-t border-border-light">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Built for time-based entertainment
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
            Qcontrol is purposely engineered for physical venues where time equals money.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {cases.map((useCase, idx) => (
          <ScrollReveal key={idx} animation="fade-up" delay={idx * 150}>
            <div className="bg-bg-surface p-8 rounded-2xl border border-border-light text-center hover-lift h-full">
              <div className="text-5xl mb-6">{useCase.icon}</div>
              <h3 className="text-xl font-bold mb-3">{useCase.title}</h3>
              <p className="text-text-secondary leading-relaxed">{useCase.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
