/**
 * QControl - Local WhatsApp Conversational Simulator
 * 
 * Allows club owners, developers, and QA engineers to test the full
 * WhatsApp intelligence, booking engine, multi-club discovery, and
 * deep-link flows locally without requiring Meta Webhooks or external tunnels.
 * 
 * Usage:
 *   Interactive REPL:  npx tsx scripts/simulate-whatsapp.ts
 *   Single Message:    npx tsx scripts/simulate-whatsapp.ts "Hi"
 *   Deep Link:         npx tsx scripts/simulate-whatsapp.ts "Book at LevelUP (Code: QC_levelup)"
 *   Natural Booking:   npx tsx scripts/simulate-whatsapp.ts "Pool table today 8pm for 2 players"
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as readline from 'readline';
import { processWhatsAppMessage } from '../src/lib/services/whatsappMessageProcessor';
import { whatsappRepository } from '../src/lib/repositories/whatsappRepository';
import { qcontrolIntelligence } from '../src/lib/services/qcontrolIntelligence';
import { supabase } from '../src/lib/supabaseClient';

const DEFAULT_SIMULATED_PHONE = process.env.SIMULATED_PHONE || '919876543210';
const DEFAULT_SIMULATED_NAME = 'Local Tester';

async function sendSimulatedMessage(text: string, phone: string = DEFAULT_SIMULATED_PHONE, name: string = DEFAULT_SIMULATED_NAME) {
  const msgId = `wamid.sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Intercept outgoing messages for display in the simulator
  const body = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'SIMULATED_ACCOUNT',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: '1339039279301796'
              },
              contacts: [{ profile: { name }, wa_id: phone }],
              messages: [
                {
                  from: phone,
                  id: msgId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  console.log(`\n---------------------------------------------------------`);
  console.log(`💬 [Customer (${phone})]: "${text}"`);
  console.log(`---------------------------------------------------------`);

  // Process message through authoritative central router
  await processWhatsAppMessage(body);

  // Check state and recent log
  const state = await whatsappRepository.getState(phone);
  const { data: latestLogs } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('recipient_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestReply = latestLogs?.[0];

  if (latestReply) {
    console.log(`\n🤖 [QControl Bot Reply]:`);
    console.log(`${latestReply.content}`);
    console.log(`\n[Status]: Sent | Target Club ID: ${latestReply.business_id || 'Global Discovery'}`);
  } else {
    console.log(`\n🤖 [Bot Reply Processed]`);
  }

  // Check if a new booking was created
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('id, table_id, booking_date, start_time, duration_minutes, status, customer_name')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentBookings && recentBookings.length > 0) {
    const b = recentBookings[0];
    console.log(`\n📅 [Live Booking in DB]: ID=${b.id} | Table=${b.table_id} | Date=${b.booking_date} ${b.start_time} | Status=${b.status}`);
    console.log(`👉 View in local dashboard: http://localhost:3000/dashboard#bookings`);
  }

  if (state) {
    console.log(`\n🧠 [Conversation State]: Step=${state.current_step} | Mode=${state.conversation_mode} | Club=${state.context?.business_name || state.business_id || 'None'}`);
  }
}

async function startInteractiveRepl() {
  console.log(`=========================================================`);
  console.log(`🎱 QCONTROL LOCAL WHATSAPP CONVERSATIONAL SIMULATOR 🎱`);
  console.log(`=========================================================`);
  console.log(`Simulated Customer: ${DEFAULT_SIMULATED_NAME} (+${DEFAULT_SIMULATED_PHONE})`);
  console.log(`Connected to Local Server: http://localhost:3000`);
  console.log(`Commands:`);
  console.log(`  - Type any message: e.g. "Hi", "QC_levelup", "Pool today at 8pm"`);
  console.log(`  - "reset" to clear customer session & start over`);
  console.log(`  - "status" to view current state`);
  console.log(`  - "exit" to quit`);
  console.log(`=========================================================\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Player> '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log('Exiting WhatsApp Simulator. Happy testing!');
      process.exit(0);
    }

    if (trimmed.toLowerCase() === 'reset') {
      await whatsappRepository.clearState(DEFAULT_SIMULATED_PHONE);
      console.log(`\n🔄 Customer session state cleared for +${DEFAULT_SIMULATED_PHONE}!\n`);
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'status') {
      const state = await whatsappRepository.getState(DEFAULT_SIMULATED_PHONE);
      console.log(`\n📊 State for +${DEFAULT_SIMULATED_PHONE}:`, state, '\n');
      rl.prompt();
      return;
    }

    try {
      await sendSimulatedMessage(trimmed);
    } catch (err: any) {
      console.error('Error processing message:', err.message || err);
    }

    console.log('\n');
    rl.prompt();
  });
}

// Single-message command line mode
const directArg = process.argv.slice(2).join(' ').trim();
if (directArg) {
  sendSimulatedMessage(directArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
} else {
  startInteractiveRepl();
}
