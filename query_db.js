const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
  const envData = fs.readFileSync('.env.local', 'utf8');
  let url = '';
  let key = '';
  for (const line of envData.split('\n')) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) if (!key) key = line.split('=')[1].trim();
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('businesses').select('id, business_name, dashboard_pin').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
main();
