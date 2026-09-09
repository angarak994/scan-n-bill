import sys

with open("scratch_settings.tsx", "r") as f:
    text = f.read()

def find_block(start_marker, end_marker=None):
    s = text.find(start_marker)
    if s == -1: return ""
    if end_marker:
        e = text.find(end_marker, s)
        if e != -1: return text[s:e]
    return ""

# Block: Game Categories (lg:col-span-7)
game_categories_start = text.find('<div className="lg:col-span-7')
station_management_start = text.find('{/* Station Management */}')
game_categories_code = text[game_categories_start:station_management_start].strip()
# Remove lg:col-span-7
game_categories_code = game_categories_code.replace('<div className="lg:col-span-7 flex flex-col gap-4">', '<div className="flex flex-col gap-4">')

# Block: Station Management
promo_start = text.find('<div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">')
station_management_code = text[station_management_start:promo_start].strip()
# It closes out the parent div `      </div>\n\n`
# We need to clean it up carefully.
