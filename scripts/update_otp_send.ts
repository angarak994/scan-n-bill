import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/otp/send/route.ts', 'utf8');

if (!content.includes('normalizePhone')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

const oldValidation = `    if (!mobile || !business_id) {
      return NextResponse.json({ error: 'Mobile and Business ID are required' }, { status: 400 });
    }`;

const newValidation = `    if (!mobile || !business_id) {
      return NextResponse.json({ error: 'Mobile and Business ID are required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }`;

content = content.replace(oldValidation, newValidation);
// The DB insertion uses `mobile` so replace that with `normalizedMobile`
content = content.replace("mobile,", "mobile: normalizedMobile,");
content = content.replace("eq('mobile', mobile)", "eq('mobile', normalizedMobile)");
content = content.replace("console.error('OTP Send error:', error);", "");

fs.writeFileSync('src/app/api/otp/send/route.ts', content);
console.log('OTP send updated');
