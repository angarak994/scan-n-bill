const fs = require('fs');

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

// 1. Replace getBusinessContext
const getBusinessContextRegex = /async function getBusinessContext\(chatId: string \| number\) \{[\s\S]*?return \{ activeMembership, allActiveMemberships, revokedContext \};\n\}/;
const newGetBusinessContext = `async function getBusinessContext(chatId: string | number) {
  const searchId = String(chatId).trim();
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, pricing_rules, tables, business_name')
    .contains('pricing_rules', { globalSettings: { authorized_telegram_owners: [{ chatId: searchId }] } });

  if (error) console.error("[DB Error] getBusinessContext:", error);
  if (!businesses) return { activeMembership: null, allActiveMemberships: [], revokedContext: null };
  
  let revokedContext = null;
  let allActiveMemberships: any[] = [];
  let activeMembership = null;

  for (const b of businesses) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const owner = gs.authorized_telegram_owners.find((owner: any) => String(owner.chatId).trim() === searchId);
      if (owner) {
         const isPrimary = owner.role === 'PRIMARY_OWNER';
         if (owner.status === 'revoked') {
            const mem = { business: b, isRevoked: true, isPrimary, isActiveContext: owner.is_active_context === true };
            if (mem.isActiveContext) revokedContext = mem;
         } else {
            const mem = { business: b, isRevoked: false, isPrimary, isActiveContext: owner.is_active_context === true };
            allActiveMemberships.push(mem);
            if (mem.isActiveContext) activeMembership = mem;
         }
      }
    }
  }
  return { activeMembership, allActiveMemberships, revokedContext };
}`;
content = content.replace(getBusinessContextRegex, newGetBusinessContext);


// 2. Replace switchBusinessContext
const switchBusinessContextRegex = /async function switchBusinessContext\(chatId: string \| number, targetBusinessId: string\) \{[\s\S]*?\}[\s\n]*\}/;
const newSwitchBusinessContext = `async function switchBusinessContext(chatId: string | number, targetBusinessId: string) {
  const searchId = String(chatId).trim();
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, pricing_rules')
    .contains('pricing_rules', { globalSettings: { authorized_telegram_owners: [{ chatId: searchId }] } });
  
  if (!businesses) return;
  
  for (const b of businesses) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    let isChanged = false;
    const shouldBeActive = String(b.id) === String(targetBusinessId);
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const ownerIndex = gs.authorized_telegram_owners.findIndex((owner: any) => String(owner.chatId).trim() === searchId);
      if (ownerIndex > -1) {
         if (gs.authorized_telegram_owners[ownerIndex].is_active_context !== shouldBeActive) {
             gs.authorized_telegram_owners[ownerIndex].is_active_context = shouldBeActive;
             isChanged = true;
         }
      }
    }
    
    if (isChanged) {
       await supabase.from('businesses').update({ pricing_rules: b.pricing_rules }).eq('id', b.id);
    }
  }
}`;
content = content.replace(switchBusinessContextRegex, newSwitchBusinessContext);


// 3. Replace POST and add idempotency
const postRegex = /export async function POST\(request: Request\) \{[\s\S]*?\n\}/;
const newPost = `async function verifyIdempotency(updateId: number, chatId: string): Promise<boolean> {
  const { error } = await supabase.from('telegram_updates').insert({
    update_id: updateId,
    chat_id: chatId
  });
  if (error && error.code === '23505') { // Unique constraint violation
    console.log(\`[Idempotency] Duplicate update ignored: \${updateId}\`);
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const updateId = update.update_id;
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;

    if (updateId && chatId) {
        // Safe timeout wrap to prevent Vercel 504 Infinite Retries
        try {
            await Promise.race([
                (async () => {
                   const isNew = await verifyIdempotency(updateId, String(chatId));
                   if (isNew) {
                       await processWebhook(update);
                   }
                })(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Vercel Timeout Prevention')), 8500))
            ]);
        } catch (err: any) {
            console.error(\`[Webhook Error] update_id: \${updateId}, msg: \${err.message}\`);
        }
    }
    
    // Always return 200 OK so Telegram doesn't retry
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Parse Error:', error);
    return NextResponse.json({ ok: true, error_logged: true });
  }
}`;
content = content.replace(postRegex, newPost);

// 4. Remove processedCallbacks Set entirely since we have DB idempotency
content = content.replace(/const processedCallbacks = new Set<string>\(\);\n/g, '');
content = content.replace(/if \(processedCallbacks\.has\(callbackQueryId\)\) \{\n\s*return NextResponse\.json\(\{ ok: true \}\);\n\s*\}/g, '');
content = content.replace(/processedCallbacks\.add\(callbackQueryId\);/g, '');
content = content.replace(/setTimeout\(\(\) => processedCallbacks\.delete\(callbackQueryId\), 5000\);/g, '');

fs.writeFileSync('src/app/api/telegram-webhook/route.ts', content);
console.log('Update successful');
