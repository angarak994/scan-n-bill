const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: businesses } = await supabase.from('businesses').select('id');
  if (businesses && businesses.length > 0) {
    const { error } = await supabase.from('businesses').update({
      whatsapp_config: {
        enabled: true,
        phoneId: '1343834088802858',
        token: 'EAAbz1HZAgZB44BSV3ZAoYjIsrPclZCh0Ui7cMMiUsHVXRs2cC8zugk8FOTnGZBZBa6xNLmPBNZCzPNNqEwO2ljTRevZBOYJOTJKz72wkfm8Y9jjL70QoAoADrEC9ZAKNcwAOgcPOZBhg9fZBXZBz5yBoIo9JlB4ua5hJHCAZAhkHyafM8zSi82W9wIUM7i7XBsSBU4PK2qZC7d0YAs63BsEgRv7Yfrgfxhe5TwsZBdsVld9ZC3fmPIojcD60VHj93goSkfTUZBLKwoZACCEZA8IrZCRJz6qyRuvoZC71U'
      }
    }).in('id', businesses.map(b => b.id));
    console.log(error ? 'Error: ' + JSON.stringify(error) : 'Updated successfully!');
  } else {
    console.log('No businesses found.');
  }
}
main();
