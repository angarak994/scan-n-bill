import re

# Read original
with open("original_page.tsx", "r") as f:
    orig_text = f.read()

s = orig_text.find("{/* Smart Reminders & Telegram UI */}")
e = orig_text.find("  const renderSupport = () => (")

telegram_full = orig_text[s:e]

# Clean up the end of telegram_full which has the closing divs for renderSettings
# Find the end of the telegram div
# In original_page.tsx:
# 3024:       </div>
# 3025:       </div>
# 3026:     </div>
# 3027:   );

t_end = telegram_full.rfind('  );')
if t_end != -1:
    telegram_clean = telegram_full[:t_end]
    # Remove the extra closing divs of renderSettings
    telegram_clean = telegram_clean.rstrip()
    if telegram_clean.endswith('</div>'):
        telegram_clean = telegram_clean[:-6].rstrip()
    if telegram_clean.endswith('</div>'):
        telegram_clean = telegram_clean[:-6].rstrip()

with open("src/app/dashboard/page.tsx", "r") as f:
    curr_text = f.read()

# In curr_text, find the broken line: "          {/* Smart Reminders & Telegram\n          {/* WhatsApp Integration Setting */}"
# We just replace "          {/* Smart Reminders & Telegram" with the clean telegram block
bad_str = "          {/* Smart Reminders & Telegram\n"
if bad_str in curr_text:
    new_text = curr_text.replace(bad_str, telegram_clean + "\n")
    with open("src/app/dashboard/page.tsx", "w") as f:
        f.write(new_text)
    print("Fixed!")
else:
    print("Bad string not found")

