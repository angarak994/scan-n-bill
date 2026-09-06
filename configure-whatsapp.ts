import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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
    console.log(error ? 'Error updating Supabase: ' + JSON.stringify(error) : 'Successfully updated all businesses with the test WhatsApp credentials!');
  }
}
main();
