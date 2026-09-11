import ScrollReveal from '@/components/ui/ScrollReveal';
import CountUp from '@/components/ui/CountUp';

export default function ROIBusinessValue() {
  const values = [
    {
      title: <><CountUp end={20} suffix="%" /> wage cost reduction</>,
      description: 'Stop paying staff to be manual timers and ledger keepers. A single manager can oversee 20+ tables.'
    },
    {
      title: <><CountUp end={0} suffix="%" /> Revenue Leakage</>,
      description: 'Every minute is tracked. Every food order is recorded. No more "forgotten" sessions or unbilled hours.'
    },
    {
      title: <><CountUp end={35} suffix="%" /> higher F&B sales</>,
      description: 'QR menus on every table mean customers order more often without waiting to catch a waiter\'s attention.'
    },
    {
      title: <><CountUp end={100} suffix="%" /> Cloud Reliability</>,
      description: 'Access your venue\'s live dashboard from anywhere in the world on any device. Your data is always secure and synced.'
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-surface border-t border-border-light">
      <div className="max-w-4xl mx-auto text-center">
        <ScrollReveal animation="fade-up" delay={0}>
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Business Outcomes</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-16">
            Stop managing the system.<br />Start growing the business.
          </h2>
        </ScrollReveal>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12 text-left">
          {values.map((val, idx) => (
            <ScrollReveal key={idx} animation="fade-up" delay={idx * 150}>
              <div className="flex gap-4 group hover-lift p-2 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-text-primary">{val.title}</h3>
                  <p className="text-text-secondary leading-relaxed">{val.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
