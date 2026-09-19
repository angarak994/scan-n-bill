import * as fs from 'fs';

let content = fs.readFileSync('src/app/login/page.tsx', 'utf8');

if (!content.includes('formatPhoneInput')) {
    content = content.replace("import { supabase } from '@/lib/supabaseClient';", "import { supabase } from '@/lib/supabaseClient';\nimport { formatPhoneInput } from '@/lib/utils/formatPhoneInput';");
}

let oldHandler = `    if (e.target.name === 'identifier') {
      const val = e.target.value.replace(/\\D/g, '').slice(0, 10);
      setFormData({ ...formData, identifier: val });
      if (val.length > 0 && val.length !== 10) {
        setPhoneError('Please enter a valid 10-digit mobile number.');
      } else {
        setPhoneError('');
      }
    } else {`;

let newHandler = `    if (e.target.name === 'identifier') {
      const val = formatPhoneInput(e.target.value);
      setFormData({ ...formData, identifier: val });
      if (val.length > 0 && val.length !== 10) {
        setPhoneError('Please enter a valid 10-digit mobile number.');
      } else {
        setPhoneError('');
      }
    } else {`;

content = content.replace(oldHandler, newHandler);
fs.writeFileSync('src/app/login/page.tsx', content);
console.log('Login frontend updated');
