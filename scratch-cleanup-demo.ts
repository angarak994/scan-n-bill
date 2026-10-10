import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function cleanup() {
  const { data: demos, error: fetchErr } = await supabase
    .from('businesses')
    .select('id, created_at')
    .eq('business_name', 'Strike Zone (Demo)')
    .order('created_at', { ascending: false });

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  if (!demos || demos.length <= 1) {
    console.log("Only one or zero demo accounts found. No cleanup needed.");
    return;
  }

  console.log(`Found ${demos.length} demo accounts. Deleting all except the newest one...`);

  // Keep the newest one (index 0), delete the rest
  for (let i = 1; i < demos.length; i++) {
    const idToDelete = demos[i].id;
    console.log(`Deleting business: ${idToDelete}`);
    const { error: delErr } = await supabase.from('businesses').delete().eq('id', idToDelete);
    if (delErr) {
      console.error(`Failed to delete ${idToDelete}:`, delErr);
    }
  }

  // Also delete 'Test' and other junk from my scripts
  const { data: testAccounts } = await supabase.from('businesses').select('id').eq('business_name', 'Test');
  if (testAccounts) {
      for (const t of testAccounts) {
         await supabase.from('businesses').delete().eq('id', t.id);
      }
  }

  console.log("Cleanup complete!");
}
cleanup();
