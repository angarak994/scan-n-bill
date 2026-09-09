import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

# 1. Define the sidebar menus for Settings and Integrations.
settings_sidebar = """
      {/* Settings Sidebar */}
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
           <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg> Payments
        </button>
        <button onClick={() => setSettingsTab('preferences')} className={`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'preferences' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>
           <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Preferences
        </button>
      </div>
      
      {/* Settings Content */}
      <div className="flex-1 w-full max-w-4xl flex flex-col gap-6">
"""

integrations_sidebar = """
  const renderIntegrations = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start w-full max-w-7xl mx-auto">
      {/* Integrations Sidebar */}
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

      <div className="flex-1 w-full max-w-4xl flex flex-col gap-6">
"""

# Let's replace the outer wrapper of renderSettings.
render_settings_start = """  const renderSettings = () => (
    <div className="flex flex-col gap-8 mt-4 w-full max-w-7xl mx-auto">"""

new_render_settings_start = f"""  const renderSettings = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start w-full max-w-7xl mx-auto">
{settings_sidebar}
"""

text = text.replace(render_settings_start, new_render_settings_start)

# Now, we wrap specific blocks inside {settingsTab === '...' && (...)} and {integrationsTab === '...' && (...)}
# We can do this by using exact text replacements.

replacements = [
    (
        '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">\n        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">',
        '{settingsTab === "pricing" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">\n        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">'
    ),
    (
        '              );}\n            })()}\n          </div>',
        '              );}\n            })()}\n          </div>\n          )}'
    ),
    (
        '{/* Station Management */}\n          <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">',
        '{/* Station Management */}\n          {settingsTab === "tables" && (<div className="lg:col-span-12 flex flex-col gap-4 border-t border-border-theme pt-6"> <!-- CHANGED GRID --> '
    ),
    (
        '            </form>\n          </div>\n        </div>\n      </div>',
        '            </form>\n          </div>\n          )} \n        </div>\n      </div>'
    ),
    (
        '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>',
        '{settingsTab === "pricing" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>'
    ),
    (
        '          </button>\n        </form>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>',
        '          </button>\n        </form>\n      </div>)}\n\n      {settingsTab === "pricing" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>'
    ),
    (
        '            </div>\n          ))}\n        </div>\n      </div>\n\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">',
        '            </div>\n          ))}\n        </div>)}\n      </div>\n\n      </div>{/* End Settings Content */}\n    </div>\n  );\n\n' + integrations_sidebar + '      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">'
    ),
    (
        '      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">\n        {/* WhatsApp Integration Setting */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
        '      <div className="grid grid-cols-1 gap-8">\n        {/* WhatsApp Integration Setting */}\n        {integrationsTab === "whatsapp" && (<div className="flex flex-col gap-6">'
    ),
    (
        '              </div>\n            )}\n          </div>\n        </div>\n\n        {/* SMS Integration Setting */}',
        '              </div>\n            )}\n          </div>\n        </div>)}\n\n        {/* SMS Integration Setting */}'
    ),
    (
        '        {/* SMS Integration Setting */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
        '        {/* SMS Integration Setting */}\n        {integrationsTab === "sms" && (<div className="flex flex-col gap-6">'
    ),
    (
        '              </button>\n            </form>\n          </div>\n        </div>\n\n        {/* System Status block */}',
        '              </button>\n            </form>\n          </div>\n        </div>)}\n\n        {/* System Status block */}'
    ),
    (
        '        {/* System Status block */}\n        <div className="lg:col-span-1 flex flex-col gap-6">',
        '        {/* System Status block */}\n        {integrationsTab === "status" && (<div className="flex flex-col gap-6">'
    ),
    (
        '              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>',
        '              </div>\n            </div>\n          </div>\n        </div>)}\n      </div>\n\n      </div>{/* End Integrations Content */}\n    </div>\n  );\n\n  // DUMMY TO KEEP REST OF FILE VALID TEMPORARILY\n  const tempRender = () => (\n    <div>\n      {settingsTab === "business" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>'
    ),
    (
        '              {isUpdatingGoals ? \'Saving...\' : \'Save Goals\'}\n            </button>\n          </div>\n        </form>\n      </div>\n\n      {/* Qpulse & QR Sections */}',
        '              {isUpdatingGoals ? \'Saving...\' : \'Save Goals\'}\n            </button>\n          </div>\n        </form>\n      </div>)}\n\n      {/* Qpulse & QR Sections */}'
    ),
    (
        '      {/* Qpulse & QR Sections */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>',
        '      {/* Qpulse & QR Sections */}\n      {settingsTab === "preferences" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>'
    ),
    (
        '                disabled={!data?.has_logged_in}\n              />\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>',
        '                disabled={!data?.has_logged_in}\n              />\n            </div>\n          </div>\n        </div>\n      </div>)}\n\n      {settingsTab === "payments" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>'
    ),
    (
        '          </>\n        ) : (\n          <div className="flex flex-col items-center justify-center py-10 bg-bg-surface border border-dashed border-border-theme rounded-xl gap-4">\n            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent">\n              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>\n            </div>\n            <div className="text-center max-w-md">\n              <h3 className="text-lg font-bold text-text-primary mb-2">No QR Code Configured</h3>\n              <p className="text-sm text-text-secondary mb-4">\n                Upload your business UPI QR code to allow customers to easily pay via their phone camera.\n              </p>\n              <label className="cursor-pointer inline-flex items-center gap-2 bg-accent text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>\n                Upload QR Image\n                <input \n                  type="file" \n                  accept="image/png, image/jpeg"\n                  className="hidden"\n                  onChange={(e) => {\n                    const file = e.target.files?.[0];\n                    if (file) handleUploadQR(file);\n                  }}\n                />\n              </label>\n            </div>\n          </div>\n        )}\n      </div>\n\n      {/* Change PIN UI */}',
        '          </>\n        ) : (\n          <div className="flex flex-col items-center justify-center py-10 bg-bg-surface border border-dashed border-border-theme rounded-xl gap-4">\n            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent">\n              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>\n            </div>\n            <div className="text-center max-w-md">\n              <h3 className="text-lg font-bold text-text-primary mb-2">No QR Code Configured</h3>\n              <p className="text-sm text-text-secondary mb-4">\n                Upload your business UPI QR code to allow customers to easily pay via their phone camera.\n              </p>\n              <label className="cursor-pointer inline-flex items-center gap-2 bg-accent text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>\n                Upload QR Image\n                <input \n                  type="file" \n                  accept="image/png, image/jpeg"\n                  className="hidden"\n                  onChange={(e) => {\n                    const file = e.target.files?.[0];\n                    if (file) handleUploadQR(file);\n                  }}\n                />\n              </label>\n            </div>\n          </div>\n        )}\n      </div>)}\n\n      {/* Change PIN UI */}'
    ),
    (
        '      {/* Change PIN UI */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">',
        '      {/* Change PIN UI */}\n      {settingsTab === "security" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">'
    ),
    (
        '        </div>\n      </div>\n\n      {/* Smart Reminders & Telegram UI */}',
        '        </div>\n      </div>)}\n\n      {/* Smart Reminders & Telegram UI */}'
    ),
    (
        '      {/* Smart Reminders & Telegram UI */}\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">',
        '      {/* Smart Reminders & Telegram UI */}\n      {integrationsTab === "telegram" && (<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">'
    ),
    (
        '              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  );',
        '              </div>\n            </div>\n          </div>\n        </div>\n      </div>)}\n    </div>\n  );'
    )
]

for old, new in replacements:
    if old not in text:
        print(f"FAILED TO FIND:\n{old[:100]}")
    text = text.replace(old, new)

# To fix the "<!-- CHANGED GRID -->", I need to remove the lg:col-span-7 and lg:col-span-5 from the grid if they are shown individually.
text = text.replace('className="lg:col-span-7 flex flex-col gap-4"', 'className="flex flex-col gap-4 w-full"')
text = text.replace('className="lg:col-span-12 flex flex-col gap-4 border-t border-border-theme pt-6"> <!-- CHANGED GRID -->', 'className="flex flex-col gap-4 pt-6">')
text = text.replace('className="grid grid-cols-1 lg:grid-cols-12 gap-8"', 'className="grid grid-cols-1 gap-8"')

# Clean up DUMMY render which was just to trick JS scope into closing the big Settings logic
# Actually, the dummy render just ends at `    </div>\n  );`.
# Let's fix that up natively.
# Wait, my regex replaced the end of the manual table discount with `... \n      </div>{/* End Settings Content */}\n    </div>\n  );\n\n...`
# Which CLOSES `renderSettings`.
# Then I added `const renderIntegrations = () => (...)`.
# Then the rest of the code down to `Business Goals` is wrapped in `const tempRender = () => (`!
# I can just remove `const tempRender = () => (` and replace the final `);` of the original `renderSettings`!
# Because what's left is `Business Goals`, `Qpulse`, `Payments`, `Security`, `Telegram`.
# Wait, I want them INSIDE the respective sub-functions!
# This approach of conditionally rendering them exactly where they stand means they all have to be in ONE function `renderSettings`.
# But `renderIntegrations` is a completely separate view `sidebarTab === 'integrations'`.
# If I just leave `renderSettings` as ONE massive function and simply rename it to `renderSettingsAndIntegrations`, then I don't need to split it!

# That is brilliant!
# I can just do:
# {sidebarTab === 'settings' && renderSettings('settings')}
# {sidebarTab === 'integrations' && renderSettings('integrations')}

