import * as fs from 'fs';

// Update portal/book/route.ts
let portalBookContent = fs.readFileSync('src/app/api/portal/book/route.ts', 'utf8');
if (!portalBookContent.includes('normalizePhone')) {
    portalBookContent = portalBookContent.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

let portalValidation = `    if (!business_id || (!customer_name && !global_customer_id) || !booking_date || !start_time) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }`;

let newPortalValidation = `    if (!business_id || (!customer_name && !global_customer_id) || !booking_date || !start_time) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }
    
    let normalizedPhone = customer_phone;
    if (customer_phone) {
        normalizedPhone = normalizePhone(customer_phone);
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 });
        }
    }`;

portalBookContent = portalBookContent.replace(portalValidation, newPortalValidation);
portalBookContent = portalBookContent.replace("customer_phone,", "customer_phone: normalizedPhone,");
portalBookContent = portalBookContent.replace("console.error('Portal Book Error:', error);", "");

fs.writeFileSync('src/app/api/portal/book/route.ts', portalBookContent);
console.log('Portal book route updated');
