import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// 1. Hide tabs in desktop sidebar
const hideTabsDesktop = `
          {(!preferences.simple_mode || true) && (
            <button onClick={() => setSidebarTab('overview')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'overview' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <LayoutDashboard size={20} className={sidebarTab === 'overview' ? 'text-accent' : 'text-text-secondary'} /> Overview
            </button>
          )}
          {(!preferences.simple_mode || true) && (
            <button onClick={() => setSidebarTab('tables')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'tables' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <Layers size={20} className={sidebarTab === 'tables' ? 'text-accent' : 'text-text-secondary'} /> Tables
            </button>
          )}
          {(!preferences.simple_mode || true) && (
            <button onClick={() => setSidebarTab('bookings')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'bookings' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <Calendar size={20} className={sidebarTab === 'bookings' ? 'text-accent' : 'text-text-secondary'} /> Bookings
            </button>
          )}
          {!preferences.simple_mode && (
            <button onClick={() => setSidebarTab('reports')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'reports' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <FileBarChart size={20} className={sidebarTab === 'reports' ? 'text-accent' : 'text-text-secondary'} /> Reports
            </button>
          )}
          {(!preferences.simple_mode || true) && preferences.enable_memberships && (
            <button onClick={() => setSidebarTab('customers')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'customers' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <Users size={20} className={sidebarTab === 'customers' ? 'text-accent' : 'text-text-secondary'} /> Members
            </button>
          )}
          {!preferences.simple_mode && (
            <button onClick={() => setSidebarTab('menu')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'menu' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <Coffee size={20} className={sidebarTab === 'menu' ? 'text-accent' : 'text-text-secondary'} /> Food & Bev
            </button>
          )}
          {(!preferences.simple_mode || true) && preferences.enable_qkhata && (
            <button onClick={() => setSidebarTab('qkhata')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'qkhata' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <Wallet size={20} className={sidebarTab === 'qkhata' ? 'text-accent' : 'text-text-secondary'} /> QKhata
            </button>
          )}
          {!preferences.simple_mode && (
            <button onClick={() => setSidebarTab('messaging')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'messaging' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <MessageSquare size={20} className={sidebarTab === 'messaging' ? 'text-accent' : 'text-text-secondary'} /> Messaging
            </button>
          )}
          {(!preferences.simple_mode || true) && (
            <button onClick={() => setSidebarTab('payments')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'payments' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
              <BadgeIndianRupee size={20} className={sidebarTab === 'payments' ? 'text-accent' : 'text-text-secondary'} /> Payments
            </button>
          )}
`;

const sidebarDesktopStart = `          <button onClick={() => setSidebarTab('overview')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'overview' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>`;
const sidebarDesktopEnd = `          <button onClick={() => setSidebarTab('payments')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'payments' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>\n            <BadgeIndianRupee size={20} className={sidebarTab === 'payments' ? 'text-accent' : 'text-text-secondary'} /> Payments\n          </button>`;

if (content.indexOf(sidebarDesktopStart) > -1) {
  content = content.replace(
    content.substring(content.indexOf(sidebarDesktopStart), content.indexOf(sidebarDesktopEnd) + sidebarDesktopEnd.length),
    hideTabsDesktop
  );
}

// 2. Hide tabs in mobile menu
const hideTabsMobile = `
              <button onClick={() => { setSidebarTab('overview'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'overview' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <LayoutDashboard size={20} /> Overview
              </button>
              <button onClick={() => { setSidebarTab('tables'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'tables' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <Layers size={20} /> Tables
              </button>
              <button onClick={() => { setSidebarTab('bookings'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'bookings' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <Calendar size={20} /> Bookings
              </button>
              {!preferences.simple_mode && (
              <button onClick={() => { setSidebarTab('reports'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'reports' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <FileBarChart size={20} /> Reports
              </button>
              )}
              {preferences.enable_memberships && (
              <button onClick={() => { setSidebarTab('customers'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'customers' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <Users size={20} /> Members
              </button>
              )}
              {!preferences.simple_mode && (
              <button onClick={() => { setSidebarTab('menu'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'menu' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <Coffee size={20} /> Food & Bev
              </button>
              )}
              {preferences.enable_qkhata && (
              <button onClick={() => { setSidebarTab('qkhata'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'qkhata' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <Wallet size={20} /> QKhata
              </button>
              )}
              {!preferences.simple_mode && (
              <button onClick={() => { setSidebarTab('messaging'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'messaging' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <MessageSquare size={20} /> Messaging
              </button>
              )}
              <button onClick={() => { setSidebarTab('payments'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'payments' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>
                <BadgeIndianRupee size={20} /> Payments
              </button>
`;

const sidebarMobileStart = `              <button onClick={() => { setSidebarTab('overview'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'overview' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>`;
const sidebarMobileEnd = `              <button onClick={() => { setSidebarTab('payments'); setIsMobileMenuOpen(false); }} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'payments' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}\`}>\n                <BadgeIndianRupee size={20} /> Payments\n              </button>`;

if (content.indexOf(sidebarMobileStart) > -1) {
  content = content.replace(
    content.substring(content.indexOf(sidebarMobileStart), content.indexOf(sidebarMobileEnd) + sidebarMobileEnd.length),
    hideTabsMobile
  );
}

// 3. Hide bottom mobile nav items conditionally
const hideTabsBottomNav = `
          <button onClick={() => setSidebarTab('overview')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'overview' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>
            {sidebarTab === 'overview' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <LayoutDashboard size={22} className={sidebarTab === 'overview' ? 'scale-110 transition-transform' : ''} />
          </button>
          <button onClick={() => setSidebarTab('tables')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'tables' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>
            {sidebarTab === 'tables' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <Layers size={22} className={sidebarTab === 'tables' ? 'scale-110 transition-transform' : ''} />
          </button>
          {!preferences.simple_mode && (
          <button onClick={() => setSidebarTab('bookings')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'bookings' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>
            {sidebarTab === 'bookings' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <Calendar size={22} className={sidebarTab === 'bookings' ? 'scale-110 transition-transform' : ''} />
          </button>
          )}
          {!preferences.simple_mode && (
          <button onClick={() => setSidebarTab('reports')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'reports' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>
            {sidebarTab === 'reports' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <FileBarChart size={22} className={sidebarTab === 'reports' ? 'scale-110 transition-transform' : ''} />
          </button>
          )}
`;

const bottomNavStart = `          <button onClick={() => setSidebarTab('overview')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'overview' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>`;
const bottomNavEnd = `          <button onClick={() => setSidebarTab('reports')} className={\`flex flex-col items-center justify-center w-full h-full gap-1.5 relative \${sidebarTab === 'reports' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}\`}>\n            {sidebarTab === 'reports' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}\n            <FileBarChart size={22} className={sidebarTab === 'reports' ? 'scale-110 transition-transform' : ''} />\n          </button>`;

if (content.indexOf(bottomNavStart) > -1) {
  content = content.replace(
    content.substring(content.indexOf(bottomNavStart), content.indexOf(bottomNavEnd) + bottomNavEnd.length),
    hideTabsBottomNav
  );
}

// 4. Update the "Start Session" Modal in Overview
// If simple_mode is ON and require_customer_name is OFF, we don't need all the inputs.
const startSessionModalStart = `<div className="space-y-4 mb-8">`;
const startSessionModalEnd = `<div className="flex gap-3 pt-2">`;
const newStartSessionModal = `
<div className="space-y-4 mb-8">
              {!preferences.require_customer_name ? (
                 <p className="text-sm text-text-secondary text-center mb-6 py-4 bg-bg-surface rounded-lg">
                   Starting a session for Guest.
                 </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Customer Name (Optional)</label>
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base" placeholder="Enter name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Mobile Number (Optional)</label>
                    <input type="tel" value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base font-mono" placeholder="9876543210" />
                  </div>
                  {!preferences.simple_mode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Game Type</label>
                      <CustomSelect value={manualGame} onChange={setManualGame} options={[{value:'pool',label:'Pool'},{value:'snooker',label:'Snooker'},{value:'mini-snooker',label:'Mini Snooker'},{value:'ps5',label:'PS5'}]} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Players</label>
                      <CustomSelect value={manualPlayers} onChange={setManualPlayers} options={[{value:'1',label:'1 Player'},{value:'2',label:'2 Players'},{value:'3',label:'3 Players'},{value:'4',label:'4 Players'}]} />
                    </div>
                  </div>
                  )}
                  {!preferences.simple_mode && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Custom Start Time (Optional)</label>
                    <input type="datetime-local" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base font-mono" />
                    <p className="text-xs text-text-secondary mt-1">Leave empty to start immediately</p>
                  </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3 pt-2">
`;

if (content.indexOf(startSessionModalStart) > -1) {
  content = content.replace(
    content.substring(content.indexOf(startSessionModalStart), content.indexOf(startSessionModalEnd) + startSessionModalEnd.length),
    newStartSessionModal
  );
}


fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log("Injected conditional UI");
