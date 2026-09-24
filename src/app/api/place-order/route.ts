import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { businessManager } from '@/lib/businessManager';
import { sessionRepository } from '@/lib/repositories/sessionRepository';

const getSheetsClient = () => {
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { session_id, business_id, cart } = data;

    if (!session_id || !business_id || !cart) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const session = await sessionRepository.findById(session_id, business_id);
    if (!session || session.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Active session not found' }, { status: 404 });
    }

    // Calculate order total
    const menuItems = business.menu_items || [];
    let orderTotal = 0;
    const itemsOrdered: string[] = [];

    for (const [itemName, qty] of Object.entries(cart)) {
      if (typeof qty !== 'number' || qty <= 0) continue;
      const menuItem = menuItems.find(i => i.name === itemName);
      if (menuItem) {
        orderTotal += menuItem.price * qty;
        itemsOrdered.push(`${qty}x ${itemName}`);
      }
    }

    if (orderTotal === 0) {
      return NextResponse.json({ error: 'Empty order' }, { status: 400 });
    }

    // Update session food_cost in Supabase
    const currentFoodCost = session.food_cost || 0;
    const newFoodCost = currentFoodCost + orderTotal;
    
    await sessionRepository.update(session_id, { food_cost: newFoodCost }, business_id);

    // Create Notification to track order status
    const itemsJson = JSON.stringify(cart);
    const orderRef = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    let orderId = '';
    try {
      const { data: notif } = await supabase.from('notifications').insert({
        business_id,
        title: `Order: ${session.table_id} (${orderRef})`,
        message: `${itemsJson}|${orderTotal}|${session_id}`,
        type: 'order_pending'
      }).select('id').single();
      
      if (notif) orderId = notif.id;
    } catch(e) {
      console.error('Failed to create order notification:', e);
    }

    // Append to Google Sheets (existing)
    try {
      const sheets = getSheetsClient();
      let spreadsheetId = business.google_sheet_id;
      
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      
      let foodSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === 'Food Orders');
      
      if (!foodSheet) {
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'Food Orders'
                }
              }
            }]
          }
        });
        
        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "'Food Orders'!A1:F1",
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Timestamp', 'Table No', 'Customer Name', 'Items Ordered', 'Order Total', 'Status']]
          }
        });
      }
      
      const sheetTitle = 'Food Orders';
      
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const timestamp = formatter.format(now).replace(' am', ' AM').replace(' pm', ' PM');
      
      // Format: Timestamp, Table ID, Customer Name, Items Ordered, Order Total, Status
      const row = [
        `'${timestamp}`,
        session.table_id,
        session.customer_name,
        itemsOrdered.join(', '),
        orderTotal.toString(),
        'Pending'
      ];
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
    } catch (sheetError) {
      console.error("Google Sheets Food Order Error:", sheetError);
    }

    // Telegram Dispatch
    if (orderId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const gs = business.pricing_rules?.globalSettings;
        if (gs && Array.isArray(gs.authorized_telegram_owners)) {
           const msg = `🔔 <b>New Order Placed</b>\n\n<b>Table:</b> ${session.table_id}\n<b>Order ID:</b> #${orderRef}\n\n<b>Items:</b>\n${itemsOrdered.map(i => `• ${i}`).join('\n')}\n\n<b>Total:</b> ₹${orderTotal}`;
           const buttons = [
             [
               { text: '✅ Accept Order', callback_data: `order_accept_${orderId}` },
               { text: '🍽️ Mark Served', callback_data: `order_serve_${orderId}` }
             ]
           ];
           
           for (const owner of gs.authorized_telegram_owners) {
             if (owner.status !== 'revoked') {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     chat_id: owner.chatId,
                     text: msg,
                     parse_mode: 'HTML',
                     reply_markup: { inline_keyboard: buttons }
                   })
                });
             }
           }
        }
      } catch (telegramError) {
        console.error("Telegram Order Notification Error:", telegramError);
      }
    }

    return NextResponse.json({ success: true, new_food_cost: newFoodCost }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Place order error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
