const fs = require('fs');

let code = fs.readFileSync('src/app/api/qkhata/ledger/route.ts', 'utf8');

const importStatement = `import { getBusinessEntitlement } from '@/lib/entitlements';\n`;
if (!code.includes('getBusinessEntitlement')) {
    code = code.replace("export async function GET", importStatement + "export async function GET");
}

const checkLogic = `
    if (!businessId || !customerId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const entitlement = await getBusinessEntitlement(businessId);
    if (!entitlement.hasAccess || !entitlement.features.has_qkhata) {
        return NextResponse.json({ error: 'Upgrade required to access QKhata ledger.' }, { status: 403 });
    }
`;

code = code.replace(`    if (!businessId || !customerId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }`, checkLogic);

fs.writeFileSync('src/app/api/qkhata/ledger/route.ts', code);
console.log("Updated qkhata ledger API to enforce entitlements.");
