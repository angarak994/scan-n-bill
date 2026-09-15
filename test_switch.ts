import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const chatId = '1386320937'; // 99club active context
  const searchId = String(chatId);
  const targetBusinessId = 'a33a15a9-df7d-4fdb-bd15-e97d6312a701'; // Qcontrol

  const { data: businesses } = await supabase.from('businesses').select('*');
  console.log("Found businesses:", businesses?.length);

  for (const b of businesses || []) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    let isChanged = false;
    const shouldBeActive = String(b.id) === String(targetBusinessId);
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const ownerIndex = gs.authorized_telegram_owners.findIndex((owner: any) => String(owner.chatId).trim() === searchId);
      if (ownerIndex > -1) {
         if (gs.authorized_telegram_owners[ownerIndex].is_active_context !== shouldBeActive) {
             console.log(`Will update business ${b.business_name} to active=${shouldBeActive}`);
             gs.authorized_telegram_owners[ownerIndex].is_active_context = shouldBeActive;
             isChanged = true;
         }
      }
    }
    
    if (isChanged) {
       const { error } = await supabase.from('businesses').update({ pricing_rules: b.pricing_rules }).eq('id', b.id);
       if (error) console.error("Error updating:", error);
       else console.log(`Updated business ${b.business_name} successfully.`);
    }
  }

  // Verify
  const { data: verifyBusinesses } = await supabase.from('businesses').select('*');
  for (const b of verifyBusinesses || []) {
    const gs = b.pricing_rules?.globalSettings;
    if (Array.isArray(gs?.authorized_telegram_owners)) {
      const owner = gs.authorized_telegram_owners.find((o: any) => String(o.chatId).trim() === searchId);
      if (owner?.is_active_context) {
        console.log(`Active context is now: ${b.business_name}`);
      }
    }
  }
}
check();
