import ScrollReveal from '@/components/ui/ScrollReveal';

export default function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Set up business',
      description: 'Configure your tables, pricing tiers, and operating hours in minutes.'
    },
    {
      step: '02',
      title: 'Start managing sessions',
      description: 'Generate QR codes for tables and let the smart timers track every minute.'
    },
    {
      step: '03',
      title: 'Automate operations',
      description: 'Sync bookings, manage QKhata ledgers, and automate notifications.'
    },
    {
      step: '04',
      title: 'Grow with insights',
      description: 'Leverage AI analytics to maximize table utilization and revenue.'
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            How it works
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
            From manual chaos to streamlined operations in four simple steps.
          </p>
        </div>
      </ScrollReveal>

      <div className="relative">
        {/* Connecting Line (Desktop only) */}
        <ScrollReveal animation="fade-in" delay={500} className="hidden lg:block absolute top-1/2 left-0 w-full h-[2px] bg-border-light -translate-y-1/2 z-0" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative z-10">
          {steps.map((item, index) => (
            <ScrollReveal key={index} animation="slide-right" delay={index * 200}>
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left h-full">
                <div className="w-16 h-16 rounded-full bg-bg-surface border-4 border-bg-primary flex items-center justify-center font-bold text-accent text-xl shadow-lg mb-6 relative z-10 transition-transform hover:scale-110">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-text-secondary">{item.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
