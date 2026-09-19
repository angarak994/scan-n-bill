import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// The best way to hide sidebar tabs is to wrap the button definitions conditionally.
const wrapTab = (tabName: string, condition: string) => {
  // Desktop
  const desktopRegex = new RegExp(`(<button onClick={\\(\\) => setSidebarTab\\('${tabName}'\\)} className={\`flex items-center[\\s\\S]*?<\\/button>)`, 'g');
  content = content.replace(desktopRegex, `{${condition} && (\n$1\n)}`);
  
  // Mobile menu
  const mobileRegex = new RegExp(`(<button onClick={\\(\\) => { setSidebarTab\\('${tabName}'\\); setIsMobileMenuOpen\\(false\\); }} className={\`flex items-center[\\s\\S]*?<\\/button>)`, 'g');
  content = content.replace(mobileRegex, `{${condition} && (\n$1\n)}`);
  
  // Bottom Nav
  const bottomNavRegex = new RegExp(`(<button onClick={\\(\\) => setSidebarTab\\('${tabName}'\\)} className={\`flex flex-col items-center[\\s\\S]*?<\\/button>)`, 'g');
  content = content.replace(bottomNavRegex, `{${condition} && (\n$1\n)}`);
}

// 1. Hide tabs based on Simple Mode
wrapTab('reports', '!preferences.simple_mode');
wrapTab('menu', '!preferences.simple_mode');
wrapTab('messaging', '!preferences.simple_mode');

// 2. Hide tabs based on Feature Flags (and potentially Simple Mode)
wrapTab('customers', '(!preferences.simple_mode || true) && preferences.enable_memberships');
wrapTab('qkhata', '(!preferences.simple_mode || true) && preferences.enable_qkhata');

// 3. Update the Start Session modal conditionally
const oldStartModal = `<div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Customer Name (Optional)</label>
                  <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base" placeholder="Enter name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Mobile Number (Optional)</label>
                  <input type="tel" value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base font-mono" placeholder="9876543210" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Game Type</label>
                    <CustomSelect 
                      value={manualGame} 
                      onChange={setManualGame} 
                      options={[
                        {value: 'pool', label: 'Pool'},
                        {value: 'snooker', label: 'Snooker'},
                        {value: 'mini-snooker', label: 'Mini Snooker'},
                        {value: 'ps5', label: 'PS5'}
                      ]} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Players</label>
                    <CustomSelect 
                      value={manualPlayers} 
                      onChange={setManualPlayers} 
                      options={[
                        {value: '1', label: '1 Player'},
                        {value: '2', label: '2 Players'},
                        {value: '3', label: '3 Players'},
                        {value: '4', label: '4 Players'}
                      ]} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Custom Start Time (Optional)</label>
                  <input type="datetime-local" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-base font-mono" />
                  <p className="text-xs text-text-secondary mt-1">Leave empty to start immediately</p>
                </div>`;

const newStartModal = `
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
                      <CustomSelect 
                        value={manualGame} 
                        onChange={setManualGame} 
                        options={[
                          {value: 'pool', label: 'Pool'},
                          {value: 'snooker', label: 'Snooker'},
                          {value: 'mini-snooker', label: 'Mini Snooker'},
                          {value: 'ps5', label: 'PS5'}
                        ]} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Players</label>
                      <CustomSelect 
                        value={manualPlayers} 
                        onChange={setManualPlayers} 
                        options={[
                          {value: '1', label: '1 Player'},
                          {value: '2', label: '2 Players'},
                          {value: '3', label: '3 Players'},
                          {value: '4', label: '4 Players'}
                        ]} 
                      />
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
`;

content = content.replace(oldStartModal, newStartModal);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Sidebar UI conditionally wrapped safely');
