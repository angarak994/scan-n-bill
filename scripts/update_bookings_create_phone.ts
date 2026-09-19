import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/bookings/create/route.ts', 'utf8');
if (!content.includes('normalizePhone')) {
    content = content.replace("import { sendSMS } from '@/lib/services/smsService';", "import { sendSMS } from '@/lib/services/smsService';\nimport { normalizePhone } from '@/lib/utils/phoneValidation';");
}

let oldValidation = `    const { business_id, table_id, customer_name, customer_phone, booking_date, start_time, duration_minutes, game_type } = body;

    if (!business_id || !table_id || !customer_name || !booking_date || !start_time || !duration_minutes) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }`;

let newValidation = `    const { business_id, table_id, customer_name, customer_phone, booking_date, start_time, duration_minutes, game_type } = body;

    if (!business_id || !table_id || !customer_name || !booking_date || !start_time || !duration_minutes) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let normalizedPhone = customer_phone;
    if (customer_phone && customer_phone !== 'Manual / Walk-In') {
        normalizedPhone = normalizePhone(customer_phone);
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 });
        }
    }`;

content = content.replace(oldValidation, newValidation);
content = content.replace("customer_phone: customer_phone || 'Manual / Walk-In',", "customer_phone: normalizedPhone || 'Manual / Walk-In',");
content = content.replace("const cleanPhone = customer_phone.replace(/\\D/g, '');", "const cleanPhone = normalizedPhone;");
content = content.replace("if (cleanPhone.length >= 10) {", "if (cleanPhone) {");

fs.writeFileSync('src/app/api/bookings/create/route.ts', content);
console.log('Bookings create updated');
