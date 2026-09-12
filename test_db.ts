import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function test() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  if (error) console.error("Error:", error);
  else {
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data, but query succeeded");
      // Try to insert a dummy record to see if member_id causes an error
      const { error: insertError } = await supabase.from('sessions').insert([{
        id: 'test-id',
        business_id: 'test-business',
        customer_name: 'test',
        table_id: 'test',
        game_type: 'pool',
        start_time: new Date().toISOString(),
        member_id: 'test-member'
      }]);
      console.log("Insert with member_id error:", insertError);
    }
  }
}
test();
