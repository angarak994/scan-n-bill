import re

with open("original_page.tsx", "r") as f:
    text = f.read()

start = text.find("{/* Smart Reminders & Telegram UI */}")
end = text.find("{/* WhatsApp Integration Setting */}")

if start != -1 and end != -1:
    telegram_code = text[start:end]
    print(telegram_code)
else:
    print("Not found")
