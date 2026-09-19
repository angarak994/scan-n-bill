import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

const settingsPanelInject = `
      {/* SIMPLE MODE / BUSINESS CUSTOMIZATION */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              QControl Customization
              {isUpdatingPreferences && <span className="text-xs font-normal text-text-secondary animate-pulse">Saving...</span>}
            </h2>
            <p className="text-sm text-text-secondary mt-1">Configure how QControl looks and works for your business.</p>
          </div>
          <button 
            onClick={() => handleUpdatePreference('simple_mode', !preferences.simple_mode)}
            className={\`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all \${preferences.simple_mode ? 'bg-success text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-bg-surface text-text-secondary border border-border-theme hover:border-accent'}\`}
          >
            {preferences.simple_mode ? 'Simple Mode ON' : 'Simple Mode OFF'}
          </button>
        </div>

        {!preferences.simple_mode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-surface p-6 rounded-xl border border-border-theme/50">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Workflow Features</h3>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={preferences.require_customer_name} onChange={(e) => handleUpdatePreference('require_customer_name', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Require Customer Name for Sessions</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={preferences.enable_memberships} onChange={(e) => handleUpdatePreference('enable_memberships', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Enable Memberships System</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={preferences.enable_qkhata} onChange={(e) => handleUpdatePreference('enable_qkhata', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Enable QKhata (Credit) System</span>
              </label>
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Display Preferences</h3>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={preferences.show_pricing_on_dashboard} onChange={(e) => handleUpdatePreference('show_pricing_on_dashboard', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Show Live Pricing on Active Sessions</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={preferences.show_member_details} onChange={(e) => handleUpdatePreference('show_member_details', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Show Member Details in Tables</span>
              </label>
            </div>
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-border-theme/50">
               <p className="text-xs text-text-secondary">Changes save automatically and apply immediately across the dashboard and Telegram bot.</p>
            </div>
          </div>
        )}
      </div>
`;

content = content.replace(
  "{/* Membership Plans Management */}",
  settingsPanelInject + "\n\n      {/* Membership Plans Management */}"
);

// If simple mode is ON, hide the other settings
const hideSettingsInject = `
    if (preferences.simple_mode) {
      return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2 text-text-primary">Business Settings</h1>
            <p className="text-text-secondary">Manage your core business preferences.</p>
          </div>
          ${settingsPanelInject.replace(/\\/g, '\\\\').replace(/\$/g, '\\$')}
        </div>
      );
    }
`;

content = content.replace(
  "const renderSettings = () => {",
  "const renderSettings = () => {\n" + hideSettingsInject
);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log("Injected settings panel");
