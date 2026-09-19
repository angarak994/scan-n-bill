import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

// Replace the buggy fetch with direct startSession calls
const buggyFetch1 = `const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        table_id: tableId,
                        game_type: gameType,
                        customer_name: 'Guest',
                        business_id: business.id
                    })
                 });
                 const startData = await startRes.json();
                 if (startRes.ok) {
                    const msg = \`✅ <b>Session Started (Guest)</b>\\n\\nTable: \${tableId}\\nGame: \${gameType}\\nStart Time: \${startData.start_time}\`;
                    if (messageId) await editTelegramMessageText(chatId, messageId, msg);
                    else await sendTelegramMessage(chatId, msg, getMainMenu(preferences));
                 } else {
                    if (messageId) await editTelegramMessageText(chatId, messageId, \`❌ Error starting session: \${startData.error}\`);
                 }`;

const cleanFetch1 = `
                try {
                    const session = await startSession(tableId, gameType as any, 'Guest', business.id, 1);
                    const msg = \`✅ <b>Session Started (Guest)</b>\\n\\nTable: \${tableId}\\nGame: \${gameType}\\nStart Time: \${new Date(session.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}\`;
                    if (messageId) await editTelegramMessageText(chatId, messageId, msg);
                    else await sendTelegramMessage(chatId, msg, getMainMenuKeyboard(0));
                } catch (error: any) {
                    if (messageId) await editTelegramMessageText(chatId, messageId, \`❌ Error starting session: \${error.message}\`);
                    else await sendTelegramMessage(chatId, \`❌ Error starting session: \${error.message}\`, getMainMenuKeyboard(0));
                }`;

content = content.replace(buggyFetch1, cleanFetch1);
content = content.replace(buggyFetch1.replace('game_type: gameType,', 'game_type: gameType,').replace('Table: ${tableId}\\nGame: ${gameType}', 'Table: ${tableId}\\nGame: ${gameType}'), cleanFetch1);

const buggyFetch2 = `const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  table_id: tableId,
                  game_type: 'ps5',
                  customer_name: 'Guest',
                  business_id: business.id,
                  num_players: parseInt(numPlayers, 10)
              })
          });
          const startData = await startRes.json();
          if (startRes.ok) {
             const msg = \`✅ <b>Session Started (Guest)</b>\\n\\nTable: \${tableId}\\nGame: PS5\\nPlayers: \${numPlayers}\\nStart Time: \${startData.start_time}\`;
             if (messageId) await editTelegramMessageText(chatId, messageId, msg);
             else await sendTelegramMessage(chatId, msg, getMainMenu(preferences));
          } else {
             if (messageId) await editTelegramMessageText(chatId, messageId, \`❌ Error starting session: \${startData.error}\`);
             else await sendTelegramMessage(chatId, \`❌ Error starting session: \${startData.error}\`, getMainMenu(preferences));
          }`;

const cleanFetch2 = `
                try {
                    const session = await startSession(tableId, 'ps5', 'Guest', business.id, parseInt(numPlayers, 10));
                    const msg = \`✅ <b>Session Started (Guest)</b>\\n\\nTable: \${tableId}\\nGame: PS5\\nPlayers: \${numPlayers}\\nStart Time: \${new Date(session.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}\`;
                    if (messageId) await editTelegramMessageText(chatId, messageId, msg);
                    else await sendTelegramMessage(chatId, msg, getMainMenuKeyboard(0));
                } catch (error: any) {
                    if (messageId) await editTelegramMessageText(chatId, messageId, \`❌ Error starting session: \${error.message}\`);
                    else await sendTelegramMessage(chatId, \`❌ Error starting session: \${error.message}\`, getMainMenuKeyboard(0));
                }`;

content = content.replace(buggyFetch2, cleanFetch2);

// There's another copy of buggyFetch1 around line 1251
const buggyFetch3 = `const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_id: tableId,
                    game_type: gameType,
                    customer_name: 'Guest',
                    business_id: business.id
                })
             });
             const startData = await startRes.json();
             if (startRes.ok) {
                const msg = \`✅ <b>Session Started (Guest)</b>\\n\\nTable: \${tableId}\\nGame: \${gameType}\\nStart Time: \${startData.start_time}\`;
                if (messageId) await editTelegramMessageText(chatId, messageId, msg);
                else await sendTelegramMessage(chatId, msg, getMainMenu(preferences));
             } else {
                if (messageId) await editTelegramMessageText(chatId, messageId, \`❌ Error starting session: \${startData.error}\`);
             }`;
content = content.replace(buggyFetch3, cleanFetch1);


fs.writeFileSync('src/app/api/telegram-webhook/route.ts', content);
console.log('Fixed Telegram bot compilation errors');
