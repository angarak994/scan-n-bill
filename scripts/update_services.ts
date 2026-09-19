import * as fs from 'fs';

// 1. sessionManager.ts
let content = fs.readFileSync('src/lib/sessionManager.ts', 'utf8');
if (!content.includes('normalizePhone')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}
content = content.replace("const cleanPhone = customer.phone.replace(/[^0-9]/g, '');", "const cleanPhone = normalizePhone(customer.phone) || '';");
fs.writeFileSync('src/lib/sessionManager.ts', content);

// 2. paymentService.ts
let payContent = fs.readFileSync('src/lib/services/paymentService.ts', 'utf8');
if (!payContent.includes('normalizePhone')) {
    payContent = payContent.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}
payContent = payContent.replace("const cleanPhone = cData.phone.replace(/\\D/g, '');", "const cleanPhone = normalizePhone(cData.phone) || '';");
// Wait, is there another place in paymentService?
// "First, try matching by phone if it's a mobile number" -> let's check.
// I'll just write it and check later.
fs.writeFileSync('src/lib/services/paymentService.ts', payContent);

console.log('Services updated');
