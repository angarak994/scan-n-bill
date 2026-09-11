import ScrollReveal from '@/components/ui/ScrollReveal';

export default function FoodBeverage() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-primary">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Food & Beverage ordering, simplified.
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
            Create a digital menu. Customers order directly from their table via the QR flow. Orders route straight to your dashboard.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto items-center">
        {/* Owner View */}
        <ScrollReveal animation="fade-up" delay={200} className="bg-bg-surface border border-border-theme p-6 rounded-2xl shadow-lg relative">
          <div className="absolute -top-3 left-6 bg-bg-card px-3 py-1 rounded-full text-xs font-bold border border-border-light text-text-secondary">Owner View</div>
          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold">Menu Manager</span>
              <span className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-bold">+ Add Item</span>
            </div>
            {['Club Sandwich', 'Cold Coffee', 'French Fries'].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pb-2 border-b border-border-light">
                <span className="text-sm font-medium">{item}</span>
                <div className="flex gap-2 items-center">
                  <span className="text-xs font-mono text-text-secondary">₹{120 + (idx * 30)}</span>
                  <div className={`w-8 h-4 rounded-full ${idx === 2 ? 'bg-bg-base border border-border-light' : 'bg-accent'} relative`}>
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 ${idx === 2 ? 'left-0.5' : 'right-0.5 shadow-sm'}`}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Customer View */}
        <ScrollReveal animation="fade-up" delay={400} className="bg-bg-surface border border-border-theme p-6 rounded-2xl shadow-lg relative max-w-[280px] mx-auto w-full md:mt-12">
          <div className="absolute -top-3 left-6 bg-accent text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Customer View</div>
          <div className="pt-4 flex flex-col gap-3">
            <div className="text-center pb-2">
              <h4 className="font-bold text-sm">Table 4 Menu</h4>
              <p className="text-[10px] text-text-secondary">Tap to order to your table</p>
            </div>
            
            <div className="flex justify-between items-center bg-bg-base p-2 rounded border border-border-light">
              <div className="flex flex-col">
                <span className="text-xs font-bold">Club Sandwich</span>
                <span className="text-[10px] text-accent">₹120</span>
              </div>
              <button className="w-6 h-6 bg-bg-surface border border-border-light rounded flex items-center justify-center text-xs hover-lift">+</button>
            </div>
            <div className="flex justify-between items-center bg-bg-base p-2 rounded border border-border-light">
              <div className="flex flex-col">
                <span className="text-xs font-bold">Cold Coffee</span>
                <span className="text-[10px] text-accent">₹150</span>
              </div>
              <button className="w-6 h-6 bg-accent text-white rounded flex items-center justify-center text-xs hover-lift">✓</button>
            </div>
            
            <button className="w-full mt-2 bg-text-primary text-bg-surface py-2 rounded text-xs font-bold flex justify-between px-3 hover:opacity-90 transition-opacity hover-lift">
              <span>View Cart (1)</span>
              <span>₹150</span>
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
