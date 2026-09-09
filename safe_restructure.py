import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

s = text.find("  const renderSettings = () => (")
e = text.find("  const renderSupport = () => (")
original = text[s:e]

# Let's find exactly the blocks in `original`.

# Game Categories + Station Management (starts at the first <div className="grid...)
# Wait, they are in a grid. If we want them in separate tabs, we should separate them.
# The grid starts at:
grid_start = original.find('<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">')
grid_end = original.find('      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">')
# Inside grid, we have lg:col-span-7 and lg:col-span-5.
game_cat_start = original.find('<div className="lg:col-span-7 flex flex-col gap-4">')
station_start = original.find('{/* Station Management */}')
station_end = grid_end # which is `      </div>\n\n`

# Let's just create variables for the RAW JSX of each block without modifying them heavily.
ps5_header = original[original.find('<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">'):grid_start]
game_cat = original[game_cat_start:station_start]
station_mgm = original[station_start:station_end]

# Promos
promo_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>')
manual_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>')
promo = original[promo_start:manual_start]

# Manual
wa_start = original.find('{/* WhatsApp Integration Setting */}')
manual_disc = original[manual_start:wa_start]

# WhatsApp
sms_start = original.find('{/* SMS Integration Setting */}')
wa = original[wa_start:sms_start]

# SMS
sys_stat_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl p-6">\n        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">')
sms = original[sms_start:sys_stat_start]

# System Status
goals_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>')
sys_stat = original[sys_stat_start:goals_start]

# Goals
qpulse_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>')
goals = original[goals_start:qpulse_start]

# QPulse
qr_start = original.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>')
qpulse = original[qpulse_start:qr_start]

# QR
pin_start = original.find('{/* Change PIN UI */}')
qr = original[qr_start:pin_start]

# PIN
telegram_start = original.find('{/* Smart Reminders & Telegram UI */}')
pin = original[pin_start:telegram_start]

# Telegram
telegram_end = original.rfind('    </div>\n  );')
telegram = original[telegram_start:telegram_end]

# Clean up trailing divs for station management if necessary
# Wait! station_mgm currently ends with `</form>\n          </div>`. Then there's `</div>\n      </div>`
# In the original, the grid closes after station_mgm.
# We will just put game_cat in its own div and station_mgm in its own div.

icons = {
    'business': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>',
    'security': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>',
    'tables': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>',
    'pricing': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    'payments': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>',
    'preferences': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
    'status': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    'telegram': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>',
    'whatsapp': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>',
    'sms': '<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>'
}

def clean_mt(s):
    return s.replace(' mt-8', '')

new_render_settings = f"""  const renderSettings = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start">
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
        <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Configuration</h3>
        <button onClick={{() => setSettingsTab('business')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'business' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['business']} Business
        </button>
        <button onClick={{() => setSettingsTab('security')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'security' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['security']} Security
        </button>
        <button onClick={{() => setSettingsTab('tables')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'tables' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['tables']} Tables
        </button>
        <button onClick={{() => setSettingsTab('pricing')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'pricing' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['pricing']} Pricing
        </button>
        <button onClick={{() => setSettingsTab('payments')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'payments' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['payments']} Payments
        </button>
        <button onClick={{() => setSettingsTab('preferences')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{settingsTab === 'preferences' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['preferences']} Preferences
        </button>
      </div>

      <div className="flex-1 w-full max-w-4xl flex flex-col gap-8">
        {{settingsTab === 'business' && (
          <>{clean_mt(goals)}</>
        )}}
        {{settingsTab === 'security' && (
          <>{clean_mt(pin)}</>
        )}}
        {{settingsTab === 'tables' && (
          <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
              Stations & Tables Configuration
            </h2>
            <div className="flex flex-col gap-4">
              {station_mgm.replace('className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8"', 'className="flex flex-col gap-4"')}
            </div>
          </div>
        )}}
        {{settingsTab === 'pricing' && (
          <>
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
              {ps5_header}
              <div className="flex flex-col gap-4">
                 {game_cat.replace('className="lg:col-span-7 flex flex-col gap-4"', 'className="flex flex-col gap-4"')}
              </div>
            </div>
            {clean_mt(promo)}
            {clean_mt(manual_disc)}
          </>
        )}}
        {{settingsTab === 'payments' && (
          <>{clean_mt(qr)}</>
        )}}
        {{settingsTab === 'preferences' && (
          <>{clean_mt(qpulse)}</>
        )}}
      </div>
    </div>
  );

"""

new_render_integrations = f"""  const renderIntegrations = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start">
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
        <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Connectivity</h3>
        <button onClick={{() => setIntegrationsTab('status')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{integrationsTab === 'status' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['status']} Status
        </button>
        <button onClick={{() => setIntegrationsTab('telegram')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{integrationsTab === 'telegram' ? 'bg-[#229ED9]/10 text-[#229ED9]' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['telegram']} Telegram
        </button>
        <button onClick={{() => setIntegrationsTab('whatsapp')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{integrationsTab === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['whatsapp']} WhatsApp
        </button>
        <button onClick={{() => setIntegrationsTab('sms')}} className={{`text-left px-4 py-3 flex items-center gap-3 rounded-lg font-bold text-sm transition-colors ${{integrationsTab === 'sms' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}}`}}>
            {icons['sms']} SMS (DLT)
        </button>
      </div>

      <div className="flex-1 w-full max-w-4xl flex flex-col gap-8">
        {{integrationsTab === 'status' && (
          <>{clean_mt(sys_stat)}</>
        )}}
        {{integrationsTab === 'whatsapp' && (
          <>{clean_mt(wa)}</>
        )}}
        {{integrationsTab === 'sms' && (
          <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
            <h2 className="text-2xl font-bold mb-6">SMS Integration Setting</h2>
            {clean_mt(sms).replace('className="lg:col-span-1 flex flex-col gap-6"', 'className="flex flex-col gap-6"')}
          </div>
        )}}
        {{integrationsTab === 'telegram' && (
          <>{clean_mt(telegram)}</>
        )}}
      </div>
    </div>
  );

"""

# Special handling for SMS because SMS was embedded in a weird way originally.
# Wait, SMS in the original code is just `{/* SMS Integration Setting */}\n <div className="lg:col-span-1 flex flex-col gap-6">...`.
# It doesn't have the parent card! Let's ensure it has a parent card wrapper.

# Finally, replace in original
new_text = text[:s] + new_render_settings + new_render_integrations + text[e:]

with open("src/app/dashboard/page.tsx", "w") as f:
    f.write(new_text)

