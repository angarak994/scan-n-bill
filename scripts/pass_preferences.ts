import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// Replace all instances of `<LiveSessionRow ` with `<LiveSessionRow preferences={preferences} `
content = content.replace(/<LiveSessionRow /g, '<LiveSessionRow preferences={preferences} ');

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Passed preferences to LiveSessionRow');
