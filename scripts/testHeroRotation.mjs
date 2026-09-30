import assert from 'assert';

console.log("Testing rotation logic...");

let localStorage = {};
let sessionStorage = {};

const mockLocation = { search: '' };
const mockDocumentElement = {
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = v; },
  getAttribute(k) { return this.attrs[k]; }
};

function resetBrowser() {
  localStorage = {};
  sessionStorage = {};
  mockLocation.search = '';
}

function runScript(nowMs) {
  // Same logic as layout.tsx
  const variants = ["flagship", "unified", "visibility", "time-based", "journey", "promotions", "digital", "status", "remote", "automation"];
  let variantId = 'flagship';
  
  const overrideMatch = mockLocation.search.match(/[?&]h=([^&]+)/);
  const override = overrideMatch ? overrideMatch[1] : null;
  
  if (override && variants.includes(override)) {
    variantId = override;
  } else {
    const now = nowMs;
    const lastSeen = localStorage['qcontrol_lastSeen'];
    const sessionVariant = sessionStorage['heroVariant'];
    
    const isNewVisit = !sessionVariant || (lastSeen && (now - parseInt(lastSeen, 10)) > 30 * 60 * 1000);
    
    if (!isNewVisit && sessionVariant) {
      variantId = sessionVariant;
    } else {
      const hasVisited = localStorage['qcontrol_visited'];
      if (!hasVisited) {
        variantId = 'flagship';
        localStorage['qcontrol_visited'] = 'true';
      } else {
        let lastId = localStorage['lastVariantId'];
        let order = JSON.parse(localStorage['variantOrder'] || '[]');
        
        if (order.length === 0) {
          order = [...variants].sort(() => Math.random() - 0.5);
          if (order[0] === lastId && order.length > 1) {
            order.push(order.shift());
          }
        }
        
        variantId = order.shift();
        localStorage['variantOrder'] = JSON.stringify(order);
      }
      localStorage['lastVariantId'] = variantId;
      sessionStorage['heroVariant'] = variantId;
    }
    localStorage['qcontrol_lastSeen'] = now.toString();
  }
  mockDocumentElement.setAttribute('data-hero-variant', variantId);
  return variantId;
}

try {
  let now = 1000000;
  
  // 1. First visit
  let v1 = runScript(now);
  assert.strictEqual(v1, 'flagship', "First visit should be flagship");
  
  // 2. Same visit (navigate)
  now += 1000;
  let v2 = runScript(now);
  assert.strictEqual(v2, 'flagship', "Same visit should remain flagship");
  
  // 3. New visit (sessionStorage cleared)
  sessionStorage = {};
  now += 1000;
  let v3 = runScript(now);
  assert.notStrictEqual(v3, 'flagship', "New visit should pick new variant");
  
  // 4. Test 12 consecutive new visits (clear session storage each time)
  let seen = new Set([v1, v3]);
  let lastSeenVariant = v3;
  
  for (let i = 0; i < 10; i++) {
    sessionStorage = {};
    now += 1000;
    let v = runScript(now);
    
    assert.notStrictEqual(v, lastSeenVariant, "Should not repeat consecutive variants");
    seen.add(v);
    lastSeenVariant = v;
  }
  
  assert.strictEqual(seen.size, 10, "Should have cycled through all 10 variants");
  
  // 5. Test 30 minute rule
  let vBefore30 = runScript(now); // same visit
  now += 31 * 60 * 1000; // fast forward 31 mins
  let vAfter30 = runScript(now); // technically session storage is still there, but 30 min passed
  assert.notStrictEqual(vBefore30, vAfter30, "Should rotate after 30 mins even if same session");
  
  // 6. Test override
  mockLocation.search = "?h=remote";
  let vOverride = runScript(now);
  assert.strictEqual(vOverride, 'remote', "Override should work");
  
  // Test invalid override
  mockLocation.search = "?h=fake_variant";
  let vFakeOverride = runScript(now);
  assert.notStrictEqual(vFakeOverride, 'fake_variant', "Fake override should fall back");
  
  console.log("✅ All rotation logic tests passed!");
} catch (e) {
  console.error("Test Failed:");
  console.error(e.message);
  process.exit(1);
}
