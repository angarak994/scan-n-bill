import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/otp/verify/route.ts', 'utf8');

if (!content.includes('normalizePhone')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

const oldValidation = `    if (!mobile || !otp || !business_id) {
      return NextResponse.json({ error: 'Mobile, OTP, and Business ID are required' }, { status: 400 });
    }`;

const newValidation = `    if (!mobile || !otp || !business_id) {
      return NextResponse.json({ error: 'Mobile, OTP, and Business ID are required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }`;

content = content.replace(oldValidation, newValidation);
content = content.replace("eq('mobile', mobile)", "eq('mobile', normalizedMobile)");
content = content.replace("console.error('OTP Verify error:', error);", "");

fs.writeFileSync('src/app/api/otp/verify/route.ts', content);
console.log('OTP verify updated');
