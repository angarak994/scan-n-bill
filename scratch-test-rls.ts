import { createClient } from '@supabase/supabase-js';

// Use ANON key instead of service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://erikelecjijchgfibuhk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3Mzc3NDQsImV4cCI6MjA5NzMxMzc0NH0.8Q-zY_rV8Z1FhVnLQ_5e6eQ2E4wWwE_R4l6x5aY2s_c'; 
// That's a fake anon key. I'll get the real anon key from .env.local

require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder');

async function run() {
  const bid = "3d7560e6-cd9e-4fde-a7c2-ea137283da72";
  const { data, error } = await supabase.from('sessions').insert([{
    business_id: bid,
    date: '27 Sep 2026',
    customer_name: 'Test',
    table_id: 'P999',
    game_type: 'pool',
    start_time: new Date().toISOString(),
    status: 'ACTIVE'
  }]).select('id').single();
  
  console.log('Data:', data);
  console.log('Error:', error);
}
run();
