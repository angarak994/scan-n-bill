import { supabase } from './src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0]));
}
run();
