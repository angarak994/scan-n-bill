import re

file_path = "src/app/dashboard/EnhancedTableView.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Backgrounds
content = content.replace('bg-[#0B0F13]', 'bg-bg-card')
content = content.replace('bg-[#0A0F0D]', 'bg-bg-primary')
content = content.replace('bg-[#16231E]', 'bg-bg-surface')
content = content.replace('bg-[#1A2E27]', 'bg-accent/10')
content = content.replace('bg-[#14241E]', 'bg-bg-surface')
content = content.replace('bg-[#1C2A29]', 'bg-bg-primary')

# Borders
content = content.replace('border-[#1C2A29]', 'border-border-theme')
content = content.replace('border-[#274036]', 'border-border-theme')
content = content.replace('border-[#1F362D]', 'border-border-theme')
content = content.replace('hover:border-[#274036]', 'hover:border-accent/50')
content = content.replace('hover:border-[#38594b]', 'hover:border-accent/50')

# Text Colors
# Let's replace text-white only in certain contexts to avoid breaking button text
content = content.replace('text-white text-sm font-bold', 'text-white text-sm font-bold') # keep buttons white
# Replace generic text-gray
content = content.replace('text-gray-500', 'text-text-disabled')
content = content.replace('text-gray-400', 'text-text-secondary')
content = content.replace('text-gray-300', 'text-text-primary')
content = content.replace('text-white cursor-text', 'text-text-primary cursor-text')
content = content.replace('text-white font-mono', 'text-text-primary font-mono')
content = content.replace('text-white tracking-tight', 'text-text-primary tracking-tight')

# Write back
with open(file_path, "w") as f:
    f.write(content)

print("Colors updated!")
