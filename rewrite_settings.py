import re

with open("src/app/dashboard/page.tsx", "r") as f:
    content = f.read()

# Find start of renderSettings
start_idx = content.find("  const renderSettings = () => (")
end_idx = content.find("  const renderSupport = () => (")

if start_idx == -1 or end_idx == -1:
    print("Could not find bounds")
    exit(1)

old_code = content[start_idx:end_idx]

# Extract specific blocks from old_code
def extract_block(start_str, end_str=None, include_start=True, brackets_match=False):
    s = old_code.find(start_str)
    if s == -1: return ""
    if not include_start:
        s += len(start_str)
    
    if brackets_match:
        # Find closing brace/div by counting
        count = 0
        for i in range(s, len(old_code)):
            if old_code[i:i+4] == "<div": count += 1
            elif old_code[i:i+5] == "</div": count -= 1
            if count == 0 and i > s:
                return old_code[s:i+6]
    elif end_str:
        e = old_code.find(end_str, s)
        if e != -1: return old_code[s:e]
    return ""

# Block 1: Game Categories & PS5 Support (but excluding Station Management)
# Actually, the easiest way is to hardcode the new layout and copy-paste the specific div structures manually in the script.
# Since it's complex, I will write the replacement manually.

