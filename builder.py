import re

with open("scratch_settings.tsx", "r") as f:
    orig = f.read()

def get_block(start_str, end_str):
    s = orig.find(start_str)
    e = orig.find(end_str, s)
    if s == -1 or e == -1:
        raise ValueError(f"Could not find block from {start_str[:20]} to {end_str[:20]}")
    block = orig[s:e]
    # Verify balance
    count = 0
    for i, c in enumerate(block):
        if c == '<': count += 1
        elif c == '>': count -= 1
    # Note: JSX syntax balance is hard to check accurately due to strings and arrow functions.
    # We will just return it verbatim.
    return block

# The original has this structure:
# <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
#   <div className="flex flex-col sm:flex-row ...">... Game Categories & PS5 Support ...</div>
#   <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
#      <div className="lg:col-span-7 flex flex-col gap-4"> ... Game Categories Body ... </div>
#      {/* Station Management */}
#      <div className="lg:col-span-5 flex flex-col gap-4 ..."> ... Station Management Body ... </form>\n          </div>
#   </div>
# </div>

# Let's extract exactly the inner parts so we can rewrap them.
ps5_header_start = '<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">'
game_cat_start = '<div className="lg:col-span-7 flex flex-col gap-4">'
station_start = '{/* Station Management */}'
station_end = '</div>\n      </div>\n\n      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">'

ps5_header = get_block(ps5_header_start, '<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">')
game_cat = get_block(game_cat_start, station_start)
game_cat = game_cat.replace('className="lg:col-span-7 flex flex-col gap-4"', 'className="flex flex-col gap-4"')

station_mgm = get_block(station_start, station_end)
# Important: station_mgm currently includes `</div>\n          </div>` ? No, station_end is `</div>\n      </div>\n\n`.
# So station_mgm ends exactly where the grid closes.
# We must ensure station_mgm is balanced. It starts with `{/* Station Management */}\n          <div className="lg:col-span-5...`.
# It ends with `</form>\n          </div>\n        `.
station_mgm_end = station_mgm.rfind('</form>') + 7
station_mgm = station_mgm[:station_mgm_end] + '\n          </div>'
station_mgm = station_mgm.replace('className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8"', 'className="flex flex-col gap-4"')

# Promo
promo_start = '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>'
promo_end = '<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">\n        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>'
promo = get_block(promo_start, promo_end).strip()

# Manual
manual_disc = get_block(promo_end, '{/* WhatsApp Integration Setting */}').strip()

# WhatsApp
wa_start = '{/* WhatsApp Integration Setting */}'
wa_end = '{/* SMS Integration Setting */}'
wa = get_block(wa_start, wa_end).strip()

# SMS
sms_start = '{/* SMS Integration Setting */}'
sys_stat_start = '<div className="bg-bg-card border border-border-theme rounded-xl p-6">\n        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">'
sms = get_block(sms_start, sys_stat_start).strip()
# SMS is just a form. It doesn't have a parent card wrapper. Let's add it later.
sms_end_idx = sms.rfind('</form>') + 7
# Wait! In the original code, sms is wrapped in `<div className="lg:col-span-1 flex flex-col gap-6">` and WhatsApp is in another.
# They are both in `<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">`!
# Let's verify sms closing tag.
# WhatsApp and SMS are inside `<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">`.
# System status is ALSO inside `<div className="lg:col-span-1 flex flex-col gap-6">` next to SMS!
# Let me extract WhatsApp, SMS, SysStat carefully.

# Actually, the original structure for these 3 is:
# <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
#   {/* WhatsApp Integration Setting */}
#   <div className="lg:col-span-1 flex flex-col gap-6">...wa...</div>
#   {/* SMS Integration Setting */}
#   <div className="lg:col-span-1 flex flex-col gap-6">...sms...
#      <div className="bg-bg-card border border-border-theme rounded-xl p-6">...sys stat...</div>
#   </div>
# </div>

