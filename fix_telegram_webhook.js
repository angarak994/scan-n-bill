const fs = require('fs');
let code = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

const importStatement = `import { getBusinessEntitlement } from '@/lib/entitlements';\n`;
if (!code.includes('getBusinessEntitlement')) {
    code = code.replace("export async function POST", importStatement + "export async function POST");
}

const checkLogic = `
          // IDEMPOTENCY: Safely parse config
          const configStr = typeof business.telegram_config === 'string' ? business.telegram_config : JSON.stringify(business.telegram_config);
          if (configStr) {
             const config = JSON.parse(configStr);
             if (config.owner_chat_id === chatId.toString()) {
                
                const entitlement = await getBusinessEntitlement(business.id);
                if (!entitlement.hasAccess || !entitlement.features.has_telegram) {
                     return sendTelegramMessage(chatId, "⚠️ Your subscription plan does not support Telegram automation. Please upgrade your plan in the QControl dashboard to unlock this feature.");
                }

                business_id = business.id;
`;

code = code.replace(`          // IDEMPOTENCY: Safely parse config
          const configStr = typeof business.telegram_config === 'string' ? business.telegram_config : JSON.stringify(business.telegram_config);
          if (configStr) {
             const config = JSON.parse(configStr);
             if (config.owner_chat_id === chatId.toString()) {
                business_id = business.id;`, checkLogic);

fs.writeFileSync('src/app/api/telegram-webhook/route.ts', code);
console.log("Updated telegram webhook to enforce entitlements.");
