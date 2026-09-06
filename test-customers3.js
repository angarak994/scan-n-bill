const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
    const { data: businesses } = await supabase.from('businesses').select('id');
    for (const b of businesses) {
        // Find one customer in this business and update them
        const { data: customers } = await supabase.from('customers').select('id').eq('business_id', b.id).limit(1);
        if (customers && customers.length > 0) {
            await supabase.from('customers').update({ phone: '918208388320' }).eq('id', customers[0].id);
        }
    }
}
run();
