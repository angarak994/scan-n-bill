require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reset() {
  console.log('Fetching all businesses...');
  const { data: businesses, error } = await supabase.from('businesses').select('id, pricing_rules');
  if (error) {
    console.error('Error fetching businesses:', error);
    process.exit(1);
  }

  console.log(`Found ${businesses.length} businesses. Resetting Telegram state...`);

  for (const b of businesses) {
    let pr = b.pricing_rules;
    if (pr && pr.globalSettings) {
      delete pr.globalSettings.telegram_chat_id;
      delete pr.globalSettings.authorized_telegram_owners;
      delete pr.globalSettings.telegram_invite_token;
      delete pr.globalSettings.primary_owner_active_context;
      
      const { error: updateError } = await supabase.from('businesses').update({ pricing_rules: pr }).eq('id', b.id);
      if (updateError) {
        console.error(`Failed to update business ${b.id}:`, updateError);
      } else {
        console.log(`Reset business ${b.id}`);
      }
    }
  }
  
  console.log('Reset complete!');
}

reset();
