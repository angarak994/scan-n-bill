import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

start_marker = "  const renderSettings = () => ("
end_marker = "  const renderSupport = () => ("
s = text.find(start_marker)
e = text.find(end_marker)

if s == -1 or e == -1:
    print("Markers not found")
    exit(1)

settings_code = text[s:e]

# Extract Game Categories Header
ps5_header = settings_code[settings_code.find('<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">'):settings_code.find('<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">')]

# Extract Game Categories body
game_cat = settings_code[settings_code.find('<div className="lg:col-span-7 flex flex-col gap-4">'):settings_code.find('{/* Station Management */}')].strip()
game_cat = game_cat.replace('<div className="lg:col-span-7 flex flex-col gap-4">', '<div className="flex flex-col gap-4">')

# Extract Station Management body
station_mgm = settings_code[settings_code.find('{/* Station Management */}'):settings_code.find('</div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">')].strip()
station_end = station_mgm.rfind('</form>') + 7
station_mgm = station_mgm[:station_end] + '\n          </div>'
station_mgm = station_mgm.replace('<div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">', '<div className="flex flex-col gap-4 pt-6">')

# Extract Launch Promo
promo = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>'):settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>')]

# Extract Manual Discounts
manual_disc = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>'):settings_code.find('{/* WhatsApp Integration Setting */}')]

# Extract WhatsApp
wa = settings_code[settings_code.find('{/* WhatsApp Integration Setting */}'):settings_code.find('{/* SMS Integration Setting */}')]

# Extract SMS
sms = settings_code[settings_code.find('{/* SMS Integration Setting */}'):settings_code.find('<div className="lg:col-span-1 flex flex-col gap-6">')]
sms_end = sms.rfind('</form>\n        )}') + 16
sms = sms[:sms_end] + '\n      </div>'

# Extract System Status
sys_stat = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl p-6">\n        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">'):settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>')]

# Extract Goals
goals = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>'):settings_code.find('{/* Qpulse & QR Sections */}')]

# Extract Qpulse
qpulse = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>'):settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>')]

# Extract Payment QR
qr = settings_code[settings_code.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>'):settings_code.find('{/* Change PIN UI */}')]

# Extract Change PIN
pin = settings_code[settings_code.find('{/* Change PIN UI */}'):settings_code.find('{/* Smart Reminders & Telegram UI */}')]

# Extract Telegram
telegram = settings_code[settings_code.find('{/* Smart Reminders & Telegram UI */}'):settings_code.rfind('</div>\n      </div>\n    </div>\n  );')]
tele_end = telegram.rfind('</div>\n        </div>\n      </div>') + 32
telegram = telegram[:tele_end]

def cleanup(s):
    return s.replace(' mt-8', '')

new_render_settings = """  const renderSettings = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
        <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Configuration</h3>
        <button onClick={() => setSettingsTab('business')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'business' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>💼 Business Profile</button>
        <button onClick={() => setSettingsTab('security')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'security' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>🔒 Security</button>
        <button onClick={() => setSettingsTab('tables')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'tables' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>🎱 Stations & Tables</button>
        <button onClick={() => setSettingsTab('pricing')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'pricing' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>💰 Pricing & Promos</button>
        <button onClick={() => setSettingsTab('payments')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'payments' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>🏦 Payments QR</button>
        <button onClick={() => setSettingsTab('preferences')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'preferences' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>✨ Preferences</button>
      </div>

      {/* Settings Content */}
      <div className="flex-1 w-full max-w-4xl flex flex-col gap-8">
        {settingsTab === 'business' && (
""" + '\n'.join('          ' + line for line in cleanup(goals).split('\n')) + """
        )}
        {settingsTab === 'security' && (
""" + '\n'.join('          ' + line for line in cleanup(pin).split('\n')) + """
        )}
        {settingsTab === 'tables' && (
          <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
              Stations & Tables Configuration
            </h2>
""" + '\n'.join('            ' + line for line in station_mgm.split('\n')) + """
          </div>
        )}
        {settingsTab === 'pricing' && (
          <>
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
""" + '\n'.join('              ' + line for line in ps5_header.split('\n')) + '\n' + '\n'.join('              ' + line for line in game_cat.split('\n')) + """
            </div>
""" + '\n'.join('            ' + line for line in cleanup(promo).split('\n')) + '\n' + '\n'.join('            ' + line for line in cleanup(manual_disc).split('\n')) + """
          </>
        )}
        {settingsTab === 'payments' && (
""" + '\n'.join('          ' + line for line in cleanup(qr).split('\n')) + """
        )}
        {settingsTab === 'preferences' && (
""" + '\n'.join('          ' + line for line in cleanup(qpulse).split('\n')) + """
        )}
      </div>
    </div>
  );

"""

new_render_integrations = """  const renderIntegrations = () => (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 mt-4 items-start">
      {/* Integrations Sidebar */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-4 bg-bg-card border border-border-theme rounded-xl sticky top-24 z-10 shadow-sm">
        <h3 className="font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 px-3">Connectivity</h3>
        <button onClick={() => setIntegrationsTab('status')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'status' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>📊 System Status</button>
        <button onClick={() => setIntegrationsTab('telegram')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'telegram' ? 'bg-[#229ED9]/10 text-[#229ED9]' : 'text-text-primary hover:bg-bg-surface'}`}>📱 Telegram Bot</button>
        <button onClick={() => setIntegrationsTab('whatsapp')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-text-primary hover:bg-bg-surface'}`}>💬 WhatsApp</button>
        <button onClick={() => setIntegrationsTab('sms')} className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${integrationsTab === 'sms' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-surface'}`}>📩 SMS (DLT)</button>
      </div>

      {/* Integrations Content */}
      <div className="flex-1 w-full max-w-4xl flex flex-col gap-8">
        {integrationsTab === 'status' && (
""" + '\n'.join('          ' + line for line in cleanup(sys_stat).split('\n')) + """
        )}
        {integrationsTab === 'whatsapp' && (
""" + '\n'.join('          ' + line for line in cleanup(wa).split('\n')) + """
        )}
        {integrationsTab === 'sms' && (
""" + '\n'.join('          ' + line for line in cleanup(sms).split('\n')) + """
        )}
        {integrationsTab === 'telegram' && (
""" + '\n'.join('          ' + line for line in cleanup(telegram).split('\n')) + """
        )}
      </div>
    </div>
  );

"""

new_code = new_render_settings + new_render_integrations
new_text = text[:s] + new_code + text[e:]

with open("src/app/dashboard/page.tsx", "w") as f:
    f.write(new_text)

print("Done replacing.")

