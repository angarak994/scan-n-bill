import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/auth/login/route.ts', 'utf8');

if (!content.includes('normalizePhone')) {
    content = content.replace("import { checkRateLimit } from '@/lib/rateLimit';", "import { checkRateLimit } from '@/lib/rateLimit';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

const oldValidation = `    if (!/^\\d{10}$/.test(identifier)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }`;

const newValidation = `    const normalizedPhone = normalizePhone(identifier);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }`;

content = content.replace(oldValidation, newValidation);
content = content.replace("eq('contact_number', identifier)", "eq('contact_number', normalizedPhone)");

fs.writeFileSync('src/app/api/auth/login/route.ts', content);
console.log('Auth login route updated');
