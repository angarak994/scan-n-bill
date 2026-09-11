import ScrollReveal from '@/components/ui/ScrollReveal';

export default function AIBusinessAssistant() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <ScrollReveal animation="slide-right" delay={0}>
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">AI For Owners</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Meet your new data analyst.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            This isn&apos;t a customer support chatbot. The Qcontrol AI Assistant analyzes your venue&apos;s raw data to give you actionable business insights. Ask natural language questions about your revenue, table utilization, and slow periods.
          </p>
          
          <div className="space-y-4">
            <div className="bg-bg-surface border border-border-light p-4 rounded-xl">
              <p className="font-bold mb-1">&quot;What&apos;s our busiest time on Thursdays?&quot;</p>
              <p className="text-text-secondary text-sm">AI identifies peak hours so you can adjust staffing.</p>
            </div>
            <div className="bg-bg-surface border border-border-light p-4 rounded-xl">
              <p className="font-bold mb-1">&quot;Who are my top 5 customers this month?&quot;</p>
              <p className="text-text-secondary text-sm">AI pulls QKhata data to help you target loyalty rewards.</p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" delay={200} className="relative w-full max-w-lg mx-auto bg-bg-surface border border-border-theme rounded-2xl shadow-2xl p-4 sm:p-6 text-sm">
          {/* Chat interface mockup */}
          <div className="flex flex-col gap-4">
            <ScrollReveal animation="fade-up" delay={500} className="self-end bg-accent text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
              How did we perform last weekend compared to the average?
            </ScrollReveal>
            <ScrollReveal animation="fade-up" delay={900} className="self-start bg-bg-base border border-border-light text-text-primary px-4 py-3 rounded-2xl rounded-tl-sm max-w-[90%]">
              <p className="mb-2">Last weekend&apos;s revenue was <strong>14% higher</strong> than your monthly average. Key drivers:</p>
              <ul className="list-disc pl-4 space-y-1 mb-2 text-text-secondary">
                <li>Table 3 utilization hit 85% (highest this month).</li>
                <li>QR menu food orders increased by 22%.</li>
              </ul>
              <p className="text-accent font-medium text-xs mt-2">✨ Recommendation: Consider adjusting Saturday evening rates up by 10% during peak hours.</p>
            </ScrollReveal>
            
            <div className="mt-4 border-t border-border-light pt-4 flex gap-2">
              <div className="flex-1 bg-bg-base border border-border-light rounded-full px-4 py-2 text-text-disabled">Ask a question about your business...</div>
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
