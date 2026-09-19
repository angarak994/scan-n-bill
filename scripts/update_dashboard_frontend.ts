import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

if (!content.includes('formatPhoneInput')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { formatPhoneInput } from '@/lib/utils/formatPhoneInput';");
}

// 1. Mobile number input for new member
content = content.replace(
    "onChange={e => setNewMember({...newMember, mobile: e.target.value})}",
    "onChange={e => setNewMember({...newMember, mobile: formatPhoneInput(e.target.value)})}"
);

// 2. End session phone matching (it had `const norm = c.phone.replace('+91', '').trim();`)
content = content.replace(
    "const norm = c.phone.replace('+91', '').trim();",
    "const norm = c.phone;" // We already normalize it in DB, so it should match exactly without +91
);

// 3. Manual session name parsing (if the owner typed a phone number, it was previously checked directly)
// Wait, `formatPhoneInput` is specifically for input formatting. 
// If there are other places where phone is input manually?
content = content.replace(
    "const norm = m.mobile ? m.mobile.replace('+91', '').trim() : '';",
    "const norm = m.mobile ? m.mobile : '';"
);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Dashboard frontend updated');
