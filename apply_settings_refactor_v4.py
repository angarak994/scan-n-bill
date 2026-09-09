import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

start_settings = text.find("  const renderSettings = () => (")
end_settings = text.find("  const renderSupport = () => (")
end_support = text.find("  return (\n    <div className=\"flex h-screen")

if start_settings == -1 or end_settings == -1 or end_support == -1:
    print("Markers not found")
    exit(1)

settings_code = text[start_settings:end_settings]
support_code = text[end_settings:end_support]

def extract(start_str, end_str, source):
    s = source.find(start_str)
    if s == -1: return ""
    if end_str is None:
        return source[s:]
    e = source.find(end_str, s)
    if e == -1: return source[s:]
    return source[s:e]

# Blocks from Settings
ps5_header = extract('<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">', '<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">', settings_code)
game_cat = extract('<div className="lg:col-span-7 flex flex-col gap-4">', '{/* Station Management */}', settings_code)
station_mgm = extract('{/* Station Management */}', '</div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">', settings_code)

promo = extract('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>', '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>', settings_code)
manual_disc = extract('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>', '{/* WhatsApp Integration Setting */}', settings_code)

wa = extract('{/* WhatsApp Integration Setting */}', '{/* SMS Integration Setting */}', settings_code)
sms = extract('{/* SMS Integration Setting */}', '<div className="lg:col-span-1 flex flex-col gap-6">', settings_code)
sys_stat = extract('<div className="bg-bg-card border border-border-theme rounded-xl p-6">\n        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">', '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>', settings_code)

goals = extract('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>', '{/* Qpulse & QR Sections */}', settings_code)
qpulse = extract('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>', '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>', settings_code)
qr = extract('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">\n        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>', '{/* Change PIN UI */}', settings_code)

pin = extract('{/* Change PIN UI */}', '{/* Smart Reminders & Telegram UI */}', settings_code)

# For telegram, it is at the very end of settings_code
telegram = extract('{/* Smart Reminders & Telegram UI */}', None, settings_code)

# Fixups for extracted blocks
# Game categories
game_cat = game_cat.replace('<div className="lg:col-span-7 flex flex-col gap-4">', '<div className="flex flex-col gap-4">').strip()
# Station management
station_end = station_mgm.rfind('</form>') + 7
station_mgm = station_mgm[:station_end] + '\n          </div>'
station_mgm = station_mgm.replace('<div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">', '<div className="flex flex-col gap-4 pt-6">').strip()

# SMS Fixup (It was embedded loosely)
sms_end = sms.rfind('</form>\n        )}') + 16
sms = sms[:sms_end] + '\n      </div>'

# Telegram Fixup: Strip the closing `  );` and wrapping `</div>` tags from renderSettings
# Find the end of the form or block.
t_end = telegram.rfind('  );')
if t_end != -1:
    telegram = telegram[:t_end].rstrip()
    if telegram.endswith('</div>'): telegram = telegram[:-6].rstrip()
    if telegram.endswith('</div>'): telegram = telegram[:-6].rstrip()
    if telegram.endswith('</div>'): telegram = telegram[:-6].rstrip()
    if telegram.endswith('</div>'): telegram = telegram[:-6].rstrip()


def cleanup(s):
    # Remove margins meant for columns
    return s.replace(' mt-8', '').strip()

new_render_settings = """  const renderSettings = () => (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 mt-4 pb-20">
      <div className="mb-2">
        <h1 className="text-3xl font-black tracking-tight mb-2">Settings</h1>
        <p className="text-text-secondary text-sm">Configure your business profile, pricing rules, and security preferences.</p>
      </div>

""" + '\n'.join('      ' + line for line in cleanup(goals).split('\n')) + """

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
""" + '\n'.join('        ' + line for line in ps5_header.split('\n')) + '\n' + '\n'.join('        ' + line for line in game_cat.split('\n')) + """
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          Stations & Tables Configuration
        </h2>
""" + '\n'.join('        ' + line for line in station_mgm.split('\n')) + """
      </div>

""" + '\n'.join('      ' + line for line in cleanup(promo).split('\n')) + '\n' + '\n'.join('      ' + line for line in cleanup(manual_disc).split('\n')) + """

""" + '\n'.join('      ' + line for line in cleanup(qr).split('\n')) + """

""" + '\n'.join('      ' + line for line in cleanup(qpulse).split('\n')) + """

""" + '\n'.join('      ' + line for line in cleanup(pin).split('\n')) + """
    </div>
  );

"""

# For support, we take the inner content of original renderSupport
support_inner = extract('<div className="max-w-5xl mx-auto flex flex-col gap-8 mt-4">', '    </div>\n  );', support_code).strip()
# Remove the opening wrapper since we recreate it
support_inner = support_inner[len('<div className="max-w-5xl mx-auto flex flex-col gap-8 mt-4">'):].strip()

new_render_support = """  const renderSupport = () => (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 mt-4 pb-20">
      <div className="mb-2">
        <h1 className="text-3xl font-black tracking-tight mb-2">Support & Integrations</h1>
        <p className="text-text-secondary text-sm">Manage your connectivity and get help when you need it.</p>
      </div>

      {/* Integrations Section */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 shadow-sm">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2 border-b border-border-theme pb-4">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          Integrations & Connectivity
        </h2>
        <div className="flex flex-col gap-10">
""" + '\n'.join('          ' + line for line in cleanup(sys_stat).split('\n')) + """
""" + '\n'.join('          ' + line for line in cleanup(telegram).split('\n')) + """
""" + '\n'.join('          ' + line for line in cleanup(wa).split('\n')) + """
""" + '\n'.join('          ' + line for line in cleanup(sms).split('\n')) + """
        </div>
      </div>

      {/* Help & Support Section */}
      <div className="mt-4">
        <h2 className="text-2xl font-black mb-6">Help Center</h2>
        <div className="flex flex-col gap-8">
""" + '\n'.join('          ' + line for line in support_inner.split('\n')) + """
        </div>
      </div>
    </div>
  );
"""

new_text = text[:start_settings] + new_render_settings + new_render_support + text[end_support:]

with open("src/app/dashboard/page.tsx", "w") as f:
    f.write(new_text)

print("Settings and Support successfully refactored.")
