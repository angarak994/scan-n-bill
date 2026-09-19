const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyIdempotency(updateId, chatId) {
  const { error } = await supabase.from('telegram_updates').insert({
    update_id: updateId,
    chat_id: String(chatId)
  });
  if (error && error.code === '23505') { // Unique constraint violation
    console.log(`[Idempotency] Duplicate update ignored: ${updateId}`);
    return false;
  }
  if (error) {
     console.error('Idempotency table error (ignoring and proceeding safely):', error.message);
     return true; // Fallback safely
  }
  return true;
}

async function test() {
  const isNew = await verifyIdempotency(99999, "test_chat");
  console.log("Is New?", isNew);
}
test();
