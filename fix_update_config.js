const fs = require('fs');

let code = fs.readFileSync('src/app/api/update-business-config/route.ts', 'utf8');

const importStatement = `import { getBusinessEntitlement } from '@/lib/entitlements';\n`;
if (!code.includes('getBusinessEntitlement')) {
    code = code.replace("import { getSession } from '@/lib/auth';", "import { getSession } from '@/lib/auth';\n" + importStatement);
}

const checkLogic = `
    const entitlement = await getBusinessEntitlement(business_id);
    if (!entitlement.hasAccess) {
        return NextResponse.json({ error: 'Your subscription is inactive. Please upgrade to manage configuration.' }, { status: 403 });
    }

    if (tables !== undefined) {
        if (tables.length > entitlement.features.max_tables) {
            return NextResponse.json({ error: \`Your \${entitlement.planName} plan only supports up to \${entitlement.features.max_tables} tables. Upgrade to add more.\` }, { status: 403 });
        }
        updatePayload.tables = tables;
    }
`;

code = code.replace("if (tables !== undefined) updatePayload.tables = tables;", checkLogic);

fs.writeFileSync('src/app/api/update-business-config/route.ts', code);
console.log("Updated update-business-config to enforce table limits.");
