import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/onboard-business/route.ts', 'utf8');

if (!content.includes('normalizePhone')) {
    content = content.replace("import { businessManager } from '@/lib/businessManager';", "import { businessManager } from '@/lib/businessManager';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

const oldValidation = `    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }`;

const newValidation = `    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(contact_number);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Contact number must be exactly 10 digits' }, { status: 400 });
    }`;

content = content.replace(oldValidation, newValidation);
content = content.replace("contact_number,", "contact_number: normalizedPhone,");

fs.writeFileSync('src/app/api/onboard-business/route.ts', content);
console.log('Onboard business route updated');
