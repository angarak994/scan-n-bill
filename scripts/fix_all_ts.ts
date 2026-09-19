import * as fs from 'fs';

// 1. bookings/create/route.ts
let bCreate = fs.readFileSync('src/app/api/bookings/create/route.ts', 'utf8');
if (!bCreate.includes('let normalizedPhone = customer_phone;')) {
    const splitPoint = "const nameToSave = (customer_name && customer_name.trim() !== '') ? customer_name.trim() : 'Walk-In / Guest';";
    const injectStr = `
    let normalizedPhone = customer_phone;
    if (customer_phone && customer_phone !== 'Manual / Walk-In') {
        normalizedPhone = normalizePhone(customer_phone);
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 });
        }
    }`;
    bCreate = bCreate.replace(splitPoint, splitPoint + injectStr);
    fs.writeFileSync('src/app/api/bookings/create/route.ts', bCreate);
}

// 2. onboard-business/route.ts
// Error: Cannot redeclare block-scoped variable 'normalizedPhone'. Cannot find name 'contact_number'.
// Let's see what happened in onboard-business. I probably did `content.replace(old, new)` which duplicated it, or it removed `contact_number` from the destructured body object!
let onboard = fs.readFileSync('src/app/api/onboard-business/route.ts', 'utf8');
onboard = onboard.replace("const { business_name, owner_name, address, google_sheet_id, business_type, pricing_rules, tables, dashboard_pin, menu_items } = data;", "const { business_name, owner_name, contact_number, address, google_sheet_id, business_type, pricing_rules, tables, dashboard_pin, menu_items } = data;");
// Remove any duplicate definitions of normalizedPhone
let obMatches = onboard.match(/const normalizedPhone = normalizePhone\(contact_number\);/g);
if (obMatches && obMatches.length > 1) {
    onboard = onboard.replace("const normalizedPhone = normalizePhone(contact_number);", ""); // remove first one
}
fs.writeFileSync('src/app/api/onboard-business/route.ts', onboard);

// 3. otp/send/route.ts
// Cannot find name 'normalizedMobile'
// I probably missed injecting it correctly.
let otpSend = fs.readFileSync('src/app/api/otp/send/route.ts', 'utf8');
if (!otpSend.includes('const normalizedMobile = normalizePhone(mobile);')) {
    const split2 = "if (!mobile || !business_id) {\n      return NextResponse.json({ error: 'Mobile and Business ID are required' }, { status: 400 });\n    }";
    otpSend = otpSend.replace(split2, split2 + "\n    const normalizedMobile = normalizePhone(mobile);\n    if (!normalizedMobile) return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });");
    fs.writeFileSync('src/app/api/otp/send/route.ts', otpSend);
}

// 4. otp/verify/route.ts
let otpVer = fs.readFileSync('src/app/api/otp/verify/route.ts', 'utf8');
if (!otpVer.includes('const normalizedMobile = normalizePhone(mobile);')) {
    const split3 = "if (!mobile || !otp || !business_id) {\n      return NextResponse.json({ error: 'Mobile, OTP, and Business ID are required' }, { status: 400 });\n    }";
    otpVer = otpVer.replace(split3, split3 + "\n    const normalizedMobile = normalizePhone(mobile);\n    if (!normalizedMobile) return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });");
    fs.writeFileSync('src/app/api/otp/verify/route.ts', otpVer);
}

// 5. portal/book/route.ts
// Cannot redeclare 'normalizedPhone', cannot find 'customer_phone'
let pb = fs.readFileSync('src/app/api/portal/book/route.ts', 'utf8');
pb = pb.replace("const { business_id, global_customer_id, customer_name, table_id, game_type, booking_date, start_time, duration_minutes } = body;", "const { business_id, global_customer_id, customer_name, customer_phone, table_id, game_type, booking_date, start_time, duration_minutes } = body;");
// Remove duplicates
let pbMatches = pb.match(/let normalizedPhone = customer_phone;/g);
if (pbMatches && pbMatches.length > 1) {
    pb = pb.replace("let normalizedPhone = customer_phone;", "");
}
fs.writeFileSync('src/app/api/portal/book/route.ts', pb);

// 6. dashboard/page.tsx
let dbPage = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');
if (!dbPage.includes('import { formatPhoneInput }')) {
    dbPage = "import { formatPhoneInput } from '@/lib/utils/formatPhoneInput';\n" + dbPage;
}
fs.writeFileSync('src/app/dashboard/page.tsx', dbPage);

// 7. paymentService.ts
let ps = fs.readFileSync('src/lib/services/paymentService.ts', 'utf8');
if (!ps.includes('import { normalizePhone }')) {
    ps = "import { normalizePhone } from '@/lib/utils/phoneValidation';\n" + ps;
}
fs.writeFileSync('src/lib/services/paymentService.ts', ps);

// 8. sessionManager.ts
let sm = fs.readFileSync('src/lib/sessionManager.ts', 'utf8');
if (!sm.includes('import { normalizePhone }')) {
    sm = "import { normalizePhone } from '@/lib/utils/phoneValidation';\n" + sm;
}
fs.writeFileSync('src/lib/sessionManager.ts', sm);

console.log('Fixed TS errors');
