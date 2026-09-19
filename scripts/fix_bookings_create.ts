import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/bookings/create/route.ts', 'utf8');

if (!content.includes("import { normalizePhone } from '@/lib/utils/phoneValidation';")) {
    content = content.replace("import { sendSMS } from '@/lib/services/smsService';", "import { sendSMS } from '@/lib/services/smsService';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

fs.writeFileSync('src/app/api/bookings/create/route.ts', content);
