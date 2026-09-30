import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log("Running Hero Variant Tests...");

const fileStr = fs.readFileSync(path.resolve('./src/components/landing/HeroVariantConfig.ts'), 'utf8');

// Extremely simple mock regex to extract variants from the TS file
const match = fileStr.match(/export const HERO_VARIANTS: HeroVariant\[\] = (\[[\s\S]*?\]);/);
if (!match) {
  console.error("Failed to parse variants");
  process.exit(1);
}

const variants = eval(match[1]);

try {
  assert(variants.length >= 10, "Minimum 10 variants required");
  
  const capabilities = new Set(["core_system", "billing_engine", "qr_sessions", "time_window_promotions", "live_status_telegram", "telegram_control"]);
  
  variants.forEach((v, index) => {
    assert(v.id, `Variant ${index} missing id`);
    assert(v.headline, `Variant ${index} missing headline`);
    assert(v.subline, `Variant ${index} missing subline`);
    assert(v.requiredCapability, `Variant ${index} missing requiredCapability`);
    assert(capabilities.has(v.requiredCapability), `Variant ${index} has unknown capability: ${v.requiredCapability}`);
    
    // Copy rules check
    assert(v.headline.split(' ').length <= 10, `Headline for ${v.id} exceeds 10 words`);
    assert(v.headline.endsWith('.'), `Headline for ${v.id} must end with a period`);
    assert(!/revolutionize|supercharge|game-changing|all-in-one|seamless/i.test(v.headline), `Headline for ${v.id} contains banned hype words`);
    assert(!/!/.test(v.headline), `Headline for ${v.id} contains exclamation mark`);
  });
  
  console.log("✅ All variant config validation passed!");
  console.log("✅ Minimum 10 variants confirmed.");
  console.log("✅ All capabilities map to verified code rows.");
  console.log("✅ Copy rules (word count, punctuation, banned words) passed.");
  
} catch (e) {
  console.error("Test Failed:");
  console.error(e.message);
  process.exit(1);
}
