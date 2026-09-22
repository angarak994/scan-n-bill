const fs = require('fs');
let code = fs.readFileSync('src/app/api/dashboard-data/route.ts', 'utf8');

// The file already has the import for getBusinessEntitlement

const entitlementLogic = `
    const entitlement = await getBusinessEntitlement(businessId);
    
    return NextResponse.json({
`;

if (!code.includes('const entitlement = await getBusinessEntitlement(businessId);')) {
    code = code.replace(`return NextResponse.json({`, entitlementLogic);
}

if (!code.includes('entitlement: entitlement')) {
    code = code.replace(`menu_items: business.menu_items || []\n    });`, `menu_items: business.menu_items || [],\n      entitlement: entitlement\n    });`);
}

fs.writeFileSync('src/app/api/dashboard-data/route.ts', code);
console.log("Fixed dashboard-data logic.");
