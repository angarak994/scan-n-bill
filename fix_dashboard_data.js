const fs = require('fs');

let code = fs.readFileSync('src/app/api/dashboard-data/route.ts', 'utf8');

const importStatement = `import { getBusinessEntitlement } from '@/lib/entitlements';\n`;
if (!code.includes('getBusinessEntitlement')) {
    code = code.replace("export async function GET", importStatement + "export async function GET");
}

const checkLogic = `
    const entitlement = await getBusinessEntitlement(businessId);
    
    return NextResponse.json({
      activeSessions,
      completedSessions,
      dailyRevenue,
      todayStr,
      pricingRules: business.pricing_rules,
      tables: business.tables,
      activeDiscounts: business.active_discounts,
      activePromotions: business.active_promotions,
      manualClosuresToday,
      revenueSavedToday,
      bookings: business.bookings,
      businessName: business.business_name,
      ownerName: business.owner_name,
      has_logged_in: business.has_logged_in,
      goals: business.goals,
      google_sheet_id: business.google_sheet_id,
      dbCustomers,
      whatsapp_config: business.whatsapp_config,
      sms_config: business.sms_config,
      menu_items: business.menu_items,
      entitlement
    });
`;

code = code.replace(/return NextResponse\.json\(\{\s*activeSessions,[\s\S]*?menu_items: business\.menu_items\s*\}\);/, checkLogic);

fs.writeFileSync('src/app/api/dashboard-data/route.ts', code);
console.log("Updated dashboard-data API to return entitlements.");
