import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

const ps5PlayersLogic = `
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, \`✅ PS5 selected for Table \${tableId} (\${numPlayers} Players). Please reply to the prompt below.\`, { inline_keyboard: [] });
        }
        await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: ps5\\nPlayers: \${numPlayers}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
          force_reply: true
        });
`;

const ps5PlayersLogicReplacement = `
        const preferences = business.pricing_rules?.globalSettings?.preferences || {};
        if (preferences.require_customer_name === false) {
          // Immediately start session
          const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
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
          }
        } else {
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, \`✅ PS5 selected for Table \${tableId} (\${numPlayers} Players). Please reply to the prompt below.\`, { inline_keyboard: [] });
          }
          await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: ps5\\nPlayers: \${numPlayers}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
            force_reply: true
          });
        }
`;

content = content.replace(ps5PlayersLogic, ps5PlayersLogicReplacement);

// Do the same for non-ps5 in start_table_
const nonPs5Logic = `
              if (messageId) {
                await editTelegramMessageText(chatId, messageId, \`✅ Table \${tableId} selected. Please reply to the prompt below.\`, { inline_keyboard: [] });
              }
              await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: \${gameType}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
                  force_reply: true
              });
`;

const nonPs5LogicReplacement = `
              const preferences = business.pricing_rules?.globalSettings?.preferences || {};
              if (preferences.require_customer_name === false) {
                 const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
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
                 }
              } else {
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, \`✅ Table \${tableId} selected. Please reply to the prompt below.\`, { inline_keyboard: [] });
                }
                await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: \${gameType}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
                    force_reply: true
                });
              }
`;

content = content.replace(nonPs5Logic, nonPs5LogicReplacement);

// Fix start_game_ non-ps5 logic as well
const startGameNonPs5Logic = `
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, \`✅ Game \${gameType} selected for Table \${tableId}. Please reply to the prompt below.\`, { inline_keyboard: [] });
          }
          await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: \${gameType}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
            force_reply: true
          });
`;

const startGameNonPs5LogicReplacement = `
          const preferences = business.pricing_rules?.globalSettings?.preferences || {};
          if (preferences.require_customer_name === false) {
             const startRes = await fetch(new URL('/api/start-session', request.url).toString(), {
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
             }
          } else {
            if (messageId) {
              await editTelegramMessageText(chatId, messageId, \`✅ Game \${gameType} selected for Table \${tableId}. Please reply to the prompt below.\`, { inline_keyboard: [] });
            }
            await sendTelegramMessage(chatId, \`👤 Enter Customer Name\\n\\nTable: \${tableId}\\nGame: \${gameType}\\n\\n(Reply to this message with the customer's name, e.g., "John")\`, {
              force_reply: true
            });
          }
`;

content = content.replace(startGameNonPs5Logic, startGameNonPs5LogicReplacement);


fs.writeFileSync('src/app/api/telegram-webhook/route.ts', content);
console.log('Updated Telegram PS5 & Auto-Start logic');
