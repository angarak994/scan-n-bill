import * as fs from 'fs';

let content = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');

// The main menu is returned by getMainMenu
const mainMenuFunctionStart = `const getMainMenu = () => {`;
const mainMenuFunctionEnd = `};`;

const newMainMenu = `const getMainMenu = (preferences: any) => {
    let topRow = [
      { text: '▶️ Start Session', callback_data: 'start_session' },
      { text: '⏹ Active Sessions', callback_data: 'active_sessions' }
    ];
    let secondRow: any[] = [];
    if (!preferences || preferences.enable_qkhata !== false) {
       secondRow.push({ text: '📒 QKhata', callback_data: 'qkhata_back' });
    }
    secondRow.push({ text: '📊 Today', callback_data: 'bk_view_today' });
    
    const inline_keyboard = secondRow.length > 0 ? [topRow, secondRow] : [topRow];
    
    return {
      reply_markup: {
        inline_keyboard
      }
    };
  };`;

// We have to replace getMainMenu in content, and then replace calls to `getMainMenu()` with `getMainMenu(business.pricing_rules?.globalSettings?.preferences)`
content = content.replace(/const getMainMenu = \(\) => \{[\s\S]*?\};\n/m, newMainMenu + '\n');
content = content.replace(/getMainMenu\(\)/g, 'getMainMenu(business.pricing_rules?.globalSettings?.preferences)');

// Also replace the "Member / Guest" step
const oldStartSessionFlow = `            const buttons = [
              [{ text: '👤 Member', callback_data: 'start_member' }, { text: '👥 Guest', callback_data: 'start_guest' }]
            ];`;
const newStartSessionFlow = `            const preferences = business.pricing_rules?.globalSettings?.preferences || {};
            const buttons = [];
            if (preferences.enable_memberships !== false) {
              buttons.push([{ text: '👤 Member', callback_data: 'start_member' }, { text: '👥 Guest', callback_data: 'start_guest' }]);
            } else {
              buttons.push([{ text: '👥 Guest', callback_data: 'start_guest' }]);
            }`;
content = content.replace(oldStartSessionFlow, newStartSessionFlow);

// Skip name if require_customer_name is false
const oldStartGuest = `      if (callbackData === 'start_guest') {
        const msg = \`Please enter the Customer Name (or reply with a phone number):\n\n(Tip: You can just type the name and send)\`;
        await sendTelegramMessage(chatId, msg, { reply_markup: { force_reply: true, selective: true } });
      }`;
const newStartGuest = `      if (callbackData === 'start_guest') {
        const preferences = business.pricing_rules?.globalSettings?.preferences || {};
        if (preferences.require_customer_name === false) {
           // Skip name, show available tables directly for "Guest"
           const { data: activeSessions } = await supabase.from('sessions').select('table_id').eq('business_id', business.id).eq('status', 'ACTIVE');
           const activeTableIds = (activeSessions || []).map(s => s.table_id);
           let availableTables = business.tables.filter((t: any) => !activeTableIds.includes(t.id));
           if (availableTables.length === 0) {
              await sendTelegramMessage(chatId, '❌ No tables available right now.', getMainMenu(preferences));
              return NextResponse.json({ ok: true });
           }
           let tButtons = availableTables.map((t: any) => [{ text: \`\${t.name} — \${t.game_type}\`, callback_data: \`start_t_\${t.id}_Guest\` }]);
           tButtons.push([{ text: '❌ Cancel', callback_data: 'cancel_start' }]);
           
           if (messageId) {
             await editTelegramMessageText(chatId, messageId, \`Select table for Guest:\`, { inline_keyboard: tButtons });
           } else {
             await sendTelegramMessage(chatId, \`Select table for Guest:\`, { inline_keyboard: tButtons });
           }
        } else {
          const msg = \`Please enter the Customer Name (or reply with a phone number):\n\n(Tip: You can just type the name and send)\`;
          await sendTelegramMessage(chatId, msg, { reply_markup: { force_reply: true, selective: true } });
        }
      }`;

content = content.replace(oldStartGuest, newStartGuest);

// Hide QKhata button in Active Session card if disabled
const oldQKhataButton = `                   if (match) {
                       buttons[0].push({ text: \`📒 QKhata\`, callback_data: \`qkhata_init_\${updatedSession.id}_\${match.id}\` });
                   }`;
const newQKhataButton = `                   const preferences = business.pricing_rules?.globalSettings?.preferences || {};
                   if (match && preferences.enable_qkhata !== false) {
                       buttons[0].push({ text: \`📒 QKhata\`, callback_data: \`qkhata_init_\${updatedSession.id}_\${match.id}\` });
                   }`;

content = content.replace(oldQKhataButton, newQKhataButton);

fs.writeFileSync('src/app/api/telegram-webhook/route.ts', content);
console.log('Telegram bot updated');
