import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .or(`and(date.gte.2026-09-01,date.lte.2026-09-17),status.eq.ACTIVE`);
  console.log('Error:', error);
  console.log('Data count:', data?.length);
}
main();
