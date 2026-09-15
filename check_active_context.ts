import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: businesses } = await supabase.from('businesses').select('id, business_name, pricing_rules');
  
  for (const b of businesses || []) {
      const owners = b.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
      for (const owner of owners) {
          if (owner.is_active_context) {
              console.log(`Business ${b.business_name} has active context for chatId ${owner.chatId}`);
          }
      }
  }
}
check();
