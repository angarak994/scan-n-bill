import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

// The request object in the POST handler is actually `req` (export async function POST(req: Request))
content = content.replace(/new URL\('\/api\/start-session', request\.url\)/g, "new URL('/api/start-session', req.url)");

// What about getMainMenu(preferences)?
// Is it out of scope, or was it getMainMenu(business.pricing_rules?.globalSettings?.preferences)?
// Wait, my replacement logic might have just put getMainMenu instead of getMainMenu(preferences) because I copied it wrongly?
// Let's check where getMainMenu is.
const getMainMenuMatcher = /getMainMenu\([^)]*\)/g;
// In my previous script, I put: `getMainMenu(preferences)`
// Wait, is it `getMainMenu` or `mainMenu`?
// The file used to have a `const mainMenu = { reply_markup: { ... } };`
// Then I replaced it with `const getMainMenu = (preferences: any) => { ... }`
// The errors say: `Cannot find name 'getMainMenu'. Did you mean 'mainMenu'?`
// This probably means `getMainMenu` is defined somewhere else, maybe inside POST instead of outside?
// Wait, let's just grep where getMainMenu is defined.
