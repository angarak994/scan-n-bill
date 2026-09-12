import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: 'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS member_id UUID;' });
  console.log("RPC result:", error || data);
}
run();
