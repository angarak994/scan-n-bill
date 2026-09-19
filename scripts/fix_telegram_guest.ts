import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

// Fix the start_guest fast-track to use the correct callback data
// Originally I used start_t_\${t.id}_Guest, but the correct one should be start_table_\${t.id}_Guest
content = content.replace(/start_t_\\\$\\{t\\.id\\}_Guest/g, 'start_table_\\${t.id}_Guest');

fs.writeFileSync('src/app/api/telegram-webhook/route.ts', content);
console.log('Fixed Telegram Guest fast-track callback');
