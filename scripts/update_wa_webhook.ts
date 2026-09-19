import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/whatsapp-webhook/route.ts', 'utf8');
if (!content.includes('normalizePhone')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

const oldCode = `        const msg = entry.changes[0].value.messages[0];
        const phone = msg.from;`;

const newCode = `        const msg = entry.changes[0].value.messages[0];
        let phone = msg.from;
        const normalized = normalizePhone(phone);
        if (normalized) phone = normalized;`;

content = content.replace(oldCode, newCode);

fs.writeFileSync('src/app/api/whatsapp-webhook/route.ts', content);
console.log('Whatsapp webhook route updated');
