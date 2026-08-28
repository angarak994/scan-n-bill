import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary overflow-x-hidden">
      {/* Navbar */}
      <nav className="w-full flex flex-wrap justify-between items-center px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tighter">QControl<span className="text-accent">.</span></span>
        </div>
        <div className="flex gap-2 sm:gap-4">
          <Link href="/login" className="px-4 py-2 sm:px-6 sm:py-2.5 rounded-full font-bold text-sm sm:text-base hover:bg-bg-surface transition-colors">
            Log In
          </Link>
          <Link href="/register" className="px-4 py-2 sm:px-6 sm:py-2.5 bg-accent text-white font-bold text-sm sm:text-base rounded-full hover:bg-accent/90 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            Add Your Club
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-32 flex flex-col items-center text-center mt-6 sm:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="absolute top-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-accent/10 rounded-full blur-[50px] sm:blur-[100px] -z-10 pointer-events-none animate-pulse duration-[3000ms]"></div>
        
        <span className="px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-xs uppercase tracking-widest mb-8 border border-accent/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          The Future of Business Operations
        </span>
        
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-tight mb-6 sm:mb-8 max-w-4xl">
          Automate your business with <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400 drop-shadow-sm">AI Bookings.</span>
        </h1>
        
        <p className="text-base sm:text-xl text-text-secondary mb-8 sm:mb-12 max-w-2xl leading-relaxed">
          The all-in-one SaaS platform for managing physical spaces and time-based services. Let our AI handle reservations while you focus on growth.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4">
          <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-accent text-white font-bold rounded-full text-base sm:text-lg hover:bg-accent/90 transition-all shadow-[0_0_40px_rgba(141,213,182,0.4)] flex items-center justify-center gap-2">
            Register Your Club
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
          </Link>
        </div>

        {/* Mockup Preview */}
        <div className="mt-12 sm:mt-24 w-full max-w-5xl rounded-2xl border border-border-theme bg-bg-card p-2 shadow-2xl relative">
          <div className="absolute -top-4 -right-2 sm:-right-4 bg-warning text-bg-base font-bold text-[10px] sm:text-xs px-3 py-1 sm:px-4 sm:py-2 rounded-full transform rotate-12 shadow-lg z-10">
            Live Sync included!
          </div>
          <div className="w-full h-12 bg-bg-surface rounded-t-xl border-b border-border-theme flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-danger"></div>
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <div className="w-3 h-3 rounded-full bg-accent"></div>
          </div>
          <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 bg-bg-base rounded-b-xl text-left">
            <div className="bg-bg-surface p-4 sm:p-6 rounded-xl border border-border-theme transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
              <h3 className="font-bold text-base sm:text-lg mb-2 flex items-center gap-2"><span className="text-xl">🤖</span> AI WhatsApp Agent</h3>
              <p className="text-text-secondary text-xs sm:text-sm">Customers book instantly via WhatsApp. No human required.</p>
            </div>
            <div className="bg-bg-surface p-4 sm:p-6 rounded-xl border border-border-theme transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
              <h3 className="font-bold text-base sm:text-lg mb-2 flex items-center gap-2">QR Smart Timers</h3>
              <p className="text-text-secondary text-xs sm:text-sm">Customers scan a QR code to start their session. Billing is exact.</p>
            </div>
            <div className="bg-bg-surface p-4 sm:p-6 rounded-xl border border-border-theme transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
              <h3 className="font-bold text-base sm:text-lg mb-2 flex items-center gap-2"><span className="text-xl">🛡️</span> Revenue Protection</h3>
              <p className="text-text-secondary text-xs sm:text-sm">Auto-alerts if a table is occupied but the timer isn't running.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
