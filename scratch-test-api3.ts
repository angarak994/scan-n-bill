import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://erikelecjijchgfibuhk.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczNzc0NCwiZXhwIjoyMDk3MzEzNzQ0fQ.Hz41XTdpLFqnMH5OiXOO28fT8x6XMWEUpNLPHeIAcKc', {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});
async function run() {
  const { data, error } = await supabase.from('sessions').insert([{
    business_id: '3d7560e6-cd9e-4fde-a7c2-ea137283da72',
    date: '27 Sep 2026',
    customer_name: 'Test',
    table_id: 'P1',
    game_type: 'pool',
    start_time: new Date().toISOString(),
    status: 'ACTIVE',
    food_cost: 0,
    num_players: 1,
  }]);
  console.log('Error:', error);
}
run();
