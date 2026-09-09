import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

settings_sidebar = """
      {/* SIDEBARS */}
      {view === 'settings' && (
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
          <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Configuration</h3>
          <button onClick={() => setSettingsTab('business')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'business' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Business
          </button>
          <button onClick={() => setSettingsTab('security')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'security' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg> Security
          </button>
          <button onClick={() => setSettingsTab('tables')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'tables' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg> Tables
          </button>
          <button onClick={() => setSettingsTab('pricing')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'pricing' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Pricing
          </button>
          <button onClick={() => setSettingsTab('payments')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'payments' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> Payments
          </button>
          <button onClick={() => setSettingsTab('preferences')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'preferences' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Preferences
          </button>
        </div>
      )}

      {view === 'integrations' && (
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
          <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Connectivity</h3>
          <button onClick={() => setIntegrationsTab('status')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'status' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Status
          </button>
          <button onClick={() => setIntegrationsTab('telegram')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'telegram' ? 'bg-[#229ED9]/10 text-[#229ED9]' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> Telegram
          </button>
          <button onClick={() => setIntegrationsTab('whatsapp')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg> WhatsApp
          </button>
          <button onClick={() => setIntegrationsTab('sms')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'sms' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg> SMS (DLT)
          </button>
        </div>
      )}

      <div className="flex-1 w-full max-w-4xl flex flex-col gap-6">
"""

text = text.replace(
    '  const renderSettings = () => (\n    <div className="flex flex-col gap-8 mt-4">',
    '  const renderSettings = (view: \'settings\' | \'integrations\') => (\n    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start w-full max-w-7xl mx-auto">\n' + settings_sidebar
)

# Replace the caller
text = text.replace(
    "{sidebarTab === 'settings' && renderSettings()}\n          {sidebarTab === 'integrations' && renderIntegrations()}",
    "{sidebarTab === 'settings' && renderSettings('settings')}\n          {sidebarTab === 'integrations' && renderSettings('integrations')}"
)

# Now wrap sections using clean replaces!

text = text.replace(
    '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">\n        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">',
    '{(view === "settings" && (settingsTab === "pricing" || settingsTab === "tables")) && (\n<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">\n        {settingsTab === "pricing" && (<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">'
)
# Game Categories inner close
text = text.replace(
    '              );}\n            })()}\n          </div>',
    '              );}\n            })()}\n          </div>\n          )}'
)
# Grid replace
text = text.replace(
    '<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">',
    '<div className={`grid grid-cols-1 gap-8 ${settingsTab === "pricing" && settingsTab === "tables" ? "lg:grid-cols-12" : "lg:grid-cols-1"}`}>'
)
# Game categories col
text = text.replace(
    '<div className="lg:col-span-7 flex flex-col gap-4">',
    '{settingsTab === "pricing" && (<div className="flex flex-col gap-4">'
)
# End of game categories, start of station
text = text.replace(
    '{/* Station Management */}\n          <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">',
    '{/* Station Management */}\n          )} {settingsTab === "tables" && (<div className="flex flex-col gap-4">'
)
# End of station management
text = text.replace(
    '            </form>\n          </div>\n        </div>\n      </div>',
    '            </form>\n          </div>\n          )} \n        </div>\n      </div>\n      )}'
)
# Launch promo
text = text.replace(
    '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>',
    '{(view === "settings" && settingsTab === "pricing") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>'
)
# End of promo, start of manual discounts
text = text.replace(
    '          </button>\n        </form>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>',
    '          </button>\n        </form>\n      </div>)}\n\n      {(view === "settings" && settingsTab === "pricing") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>'
)
# End of manual discounts, start of WhatsApp and SMS block
text = text.replace(
    '            </div>\n          ))}\n        </div>\n      </div>\n\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">',
    '            </div>\n          ))}\n        </div>\n      </div>)}\n\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">'
)

# For WhatsApp and SMS, they are in a grid.
text = text.replace(
    '      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">\n        {/* WhatsApp Integration Setting */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
    '      {(view === "integrations" && (integrationsTab === "whatsapp" || integrationsTab === "sms" || integrationsTab === "status")) && (\n      <div className={`grid grid-cols-1 gap-8 ${integrationsTab === "whatsapp" && integrationsTab === "sms" ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>\n        {/* WhatsApp Integration Setting */}\n        {integrationsTab === "whatsapp" && (<div className="flex flex-col gap-6">'
)

text = text.replace(
    '              </div>\n            )}\n          </div>\n        </div>\n\n        {/* SMS Integration Setting */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
    '              </div>\n            )}\n          </div>\n        </div>)}\n\n        {/* SMS Integration Setting */}\n        {integrationsTab === "sms" && (<div className="flex flex-col gap-6">'
)

text = text.replace(
    '              </button>\n            </form>\n          </div>\n        </div>\n\n        {/* System Status block */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
    '              </button>\n            </form>\n          </div>\n        </div>)}\n\n        {/* System Status block */}\n        {integrationsTab === "status" && (<div className="flex flex-col gap-6">'
)

text = text.replace(
    '              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>',
    '              </div>\n            </div>\n          </div>\n        </div>)}\n      </div>\n      )}\n\n      {(view === "settings" && settingsTab === "business") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>'
)

text = text.replace(
    '              {isUpdatingGoals ? \'Saving...\' : \'Save Goals\'}\n            </button>\n          </div>\n        </form>\n      </div>\n\n      {/* Qpulse & QR Sections */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>',
    '              {isUpdatingGoals ? \'Saving...\' : \'Save Goals\'}\n            </button>\n          </div>\n        </form>\n      </div>)}\n\n      {/* Qpulse & QR Sections */}\n      {(view === "settings" && settingsTab === "preferences") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>'
)

text = text.replace(
    '                disabled={!data?.has_logged_in}\n              />\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>',
    '                disabled={!data?.has_logged_in}\n              />\n            </div>\n          </div>\n        </div>\n      </div>)}\n\n      {(view === "settings" && settingsTab === "payments") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>'
)

text = text.replace(
    '          </div>\n        )}\n      </div>\n\n      {/* Change PIN UI */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">',
    '          </div>\n        )}\n      </div>)}\n\n      {/* Change PIN UI */}\n      {(view === "settings" && settingsTab === "security") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">'
)

text = text.replace(
    '        </div>\n      </div>\n\n      {/* Smart Reminders & Telegram UI */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">',
    '        </div>\n      </div>)}\n\n      {/* Smart Reminders & Telegram UI */}\n      {(view === "integrations" && integrationsTab === "telegram") && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">'
)

text = text.replace(
    '              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  );',
    '              </div>\n            </div>\n          </div>\n        </div>\n      </div>)}\n    </div>\n  );'
)

with open("src/app/dashboard/page.tsx", "w") as f:
    f.write(text)
