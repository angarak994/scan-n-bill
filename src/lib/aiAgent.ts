import OpenAI from 'openai';
import { supabase } from './supabaseClient';
import { logActivityToSheet } from './googleSheets';

let openaiInstance: OpenAI | null = null;
const useGroq = !!process.env.GROQ_API_KEY;
const getOpenAI = () => {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || 'dummy_key',
      baseURL: useGroq ? 'https://api.groq.com/openai/v1' : undefined
    });
  }
  return openaiInstance;
};

// Tool Definitions for OpenAI
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'check_table_availability',
      description: 'Check if a specific table or any table is available at a specific date and time.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'The date in YYYY-MM-DD format.' },
          start_time: { type: 'string', description: 'The start time in HH:mm:ss format (24-hour).' },
          duration_minutes: { type: 'integer', description: 'The requested duration in minutes. Default 60.' }
        },
        required: ['date', 'start_time']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_booking',
      description: 'Create a new table reservation in the system after the customer confirms.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'The name of the customer.' },
          customer_phone: { type: 'string', description: 'The phone number of the customer.' },
          date: { type: 'string', description: 'The date in YYYY-MM-DD format.' },
          start_time: { type: 'string', description: 'The start time in HH:mm:ss format (24-hour).' },
          duration_minutes: { type: 'integer', description: 'The duration in minutes.' },
          table_id: { type: 'string', description: 'The specific table ID to book.' }
        },
        required: ['customer_name', 'customer_phone', 'date', 'start_time', 'duration_minutes', 'table_id']
      }
    }
  }
];

export async function processWhatsAppMessage(message: string, senderPhone: string, businessId: string): Promise<string> {
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('API KEY is missing');
    return "I'm sorry, my AI booking system is currently offline.";
  }

  // Fetch business details for dynamic greeting and table mappings
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, owner_name, tables, pricing_rules')
    .eq('id', businessId)
    .single();
    
  const clubName = business?.business_name || 'the club';
  const ownerName = business?.owner_name || 'the owner';

  // Build table mapping for the LLM
  const tables = business?.tables || [];
  let tableMappingStr = "TABLE MAPPINGS:\n";
  if (tables.length > 0) {
    tables.forEach((t: any) => {
      tableMappingStr += `- ${t.id} -> ${t.game_type}\n`;
    });
  } else {
    tableMappingStr += "- No predefined tables found. Assume 'S' prefix means Snooker and 'P' prefix means Pool.\n";
  }

  // Check for returning customer by checking previous bookings
  const { data: pastBookings } = await supabase
    .from('bookings')
    .select('customer_name')
    .eq('business_id', businessId)
    .eq('customer_phone', senderPhone)
    .order('created_at', { ascending: false })
    .limit(1);
    
  const returningCustomerName = pastBookings && pastBookings.length > 0 ? pastBookings[0].customer_name : null;

  // Fetch recent conversation history
  const { data: historyData } = await supabase
    .from('whatsapp_chat_history')
    .select('role, content')
    .eq('customer_phone', senderPhone)
    .order('created_at', { ascending: true })
    .limit(10);

  const historyMessages = (historyData || []).map(h => ({
    role: h.role,
    content: h.content
  }));

  const isNewConversation = historyMessages.length === 0;

  // Get current date/time context for the LLM
  const now = new Date();
  
  // Format pricing rules and promotions
  const pricingRules = business?.pricing_rules || {};
  let pricingContext = "";
  if (pricingRules.activePromotion) {
    pricingContext = `\nACTIVE PROMOTION: ${pricingRules.activePromotion.title} (${pricingRules.activePromotion.discount_percent}% off).`;
  }
  
  const systemPrompt = `You are a fast, efficient, professional club receptionist booking tables via WhatsApp for ${clubName}.
The current date and time is ${now.toISOString()}.${pricingContext}

${isNewConversation ? `
CRITICAL GREETING RULES (NEW CONVERSATION):
- The user has just started a new conversation.
- If the user's message is just a greeting (e.g. "Hi", "Hello", "Start", "👋"), DO NOT jump straight into booking or ask multiple questions.
${returningCustomerName ? 
  `- This is a returning customer named ${returningCustomerName}. Greet them back warmly! Example: "Welcome back, ${returningCustomerName}! 👋 Looking to book another table?"` : 
  `- Greet them warmly and dynamically. Example: "Hi! 👋 Welcome to **${clubName}**. I'm here on behalf of **${ownerName}**. Looking to book a table today? 🎱"`
}
- Wait for them to state their intent before starting the booking flow.
` : `
CRITICAL CONVERSATION STATE (MID-BOOKING):
- You are currently in the middle of an active conversation.
- DO NOT GREET THE USER AGAIN. 
- You must maintain context. Look at the history and continue exactly from the current step.
- Do not restart the booking flow. 
- If the user simply says "No" to a question, respond naturally without restarting.
`}

CRITICAL TONE RULES:
- Be extremely direct, friendly, and fast.
- Never use filler words or excessive politeness (No "I'd be happy to help", "Please let me know", "Could you please", etc.).
- Never over-explain. Keep responses to 1-2 short sentences.
- Never ask multiple questions at once. If you need Date, Time, and Duration, just ask: "When and for how long?"
- Ask only for the exact missing information required.
- Do not ask for confirmation if you have all the details. Act immediately.
- Use natural, short phrasing: "Duration?", "Which table would you like?", "Table 1 and VIP are available. Which one?", "Booked! See you then."

CRITICAL BOUNDARIES (NO OFF-TOPIC):
- You ONLY handle table bookings.
- If the user asks about prices, location, food, rules, or anything else NOT related to booking a table, politely refuse. 
- Example refusal: "I can only assist with table reservations. What time would you like to book?"

STATE EXTRACTION & MISSING INFORMATION RULES:
- The user may provide booking details naturally (e.g., "Pool table at 6 PM", "Tomorrow at 7 for 2 hours", "Need a table tonight").
- ALWAYS parse the user's message to extract any provided details (Date, Time, Duration, Game Type).
- NEVER ignore details the user has already provided.
- NEVER ask the user to repeat information they've already given.
- Determine what information is STILL missing from: [Table/Game Type, Date, Time, Duration, Customer Name].
- Ask ONLY for the single missing piece of information required next. Do not ask for everything at once if you already know part of it.
- Example 1: Known: [Table=Pool, Time=6 PM]. Missing: [Duration]. Reply: "Got it! How long would you like to play?"
- Example 2: Known: [Time=8 PM, Duration=2 hrs]. Missing: [Date]. Reply: "Is that for today or tomorrow?"

${tableMappingStr}
CRITICAL TABLE & GAME RULES:
- The Table ID intrinsically represents the game type (see TABLE MAPPINGS). 
- If a user selects a specific table ID from the mappings, YOU ALREADY KNOW THE GAME TYPE. NEVER ask them which game they want to play.
- Treat table selection as confirmation of the game type. 
- Example: User: "[Table ID]" -> AI: (Understands the game type). AI Reply: "Great! What time would you like to play?"
- If the user explicitly asks for a game first (e.g. "I want to play pool"), only offer tables that map to that game type.

CRITICAL INSTRUCTIONS FOR TOOL CALLING:
- You have access to tools ('check_table_availability' and 'create_booking'). YOU MUST USE THEM.
- Do NOT output raw JSON, XML, or function names in your normal conversational replies. Use the structured tool_calls API format correctly.
- VALIDATION RULE: You MUST NOT call 'create_booking' until you have explicitly collected all of the following from the user: [Customer Name, Table ID, Date, Time, Duration].
- NEVER call 'create_booking' using placeholder values like "Not Provided", "Unknown", "N/A", or empty strings.
- If ANY required field is missing, DO NOT call 'create_booking'. Instead, ask the user for the missing field.

WORKFLOW:
1. Review the conversation history. NEVER ask for information that the user has already provided in the history or their current message.
2. Extract all available booking info (date, time, duration, game type, name). If anything is missing, ask directly for ONLY the missing pieces (e.g. "How long?" or "Which date?").
3. Use the 'check_table_availability' tool silently once you have Date and Time.
4. If multiple tables are available, present them beautifully:
   "**Available Tables**
   * 🎱 [Table ID]
   * 🎱 [Table ID]
   Which one would you like?"
5. If no tables are available, the tool will provide the next available slots. Present those options to the user exactly as provided.
6. Ask for their name if not provided in history or current message: "Great! What's the name for the booking?"
7. ONLY when ALL required fields (Name, Table, Date, Time, Duration) are fully known and verified, use the 'create_booking' tool silently.
8. After 'create_booking' succeeds, reply EXACTLY in this format:
   "✅ **Booking Confirmed!**
   You're all set! 🎉
   
   **Booking Details**
   * 👤 Name: [Customer Name]
   * 🎱 Table: [Table ID]
   * 📅 Date: [Readable Date]
   * 🕗 Time: [12-hour Time, e.g. 8:00 PM]
   * ⏱ Duration: [Readable Duration, e.g. 2 Hours]"`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: message }
  ];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      let bookingCompleted = false;

      // The AI wants to call a function
      for (const toolCall of responseMessage.tool_calls) {
        if ((toolCall as any).function.name === 'check_table_availability') {
          const args = JSON.parse((toolCall as any).function.arguments);
          const resultStr = await checkAvailability(args.date, args.start_time, args.duration_minutes || 60, businessId);
          
          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr
          });
        } else if ((toolCall as any).function.name === 'create_booking') {
          const args = JSON.parse((toolCall as any).function.arguments);
          const success = await createBooking(args, businessId, senderPhone);
          
          if (success) bookingCompleted = true;

          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: success ? 'Booking confirmed successfully.' : 'Failed to create booking.'
          });
        }
      }

      // Get final response from AI after providing tool results
      const finalResponse = await getOpenAI().chat.completions.create({
        model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
        messages
      });
      
      // We also need to sanitize the final response to ensure no raw function tags leak out
      let content = finalResponse.choices[0].message.content || "I'm sorry, I couldn't process that.";
      // Clean up any hallucinated <function> tags if the model fails to follow instructions
      content = content.replace(/<function[^>]*>[\s\S]*?<\/function>/g, '');
      content = content.trim();

      if (bookingCompleted) {
        // Clear memory because the booking flow is finished
        await clearChatMemory(senderPhone);
      } else {
        // Save to memory so context is preserved for the next missing piece
        await saveChatMemory(businessId, senderPhone, message, content);
      }
      return content;
    }

    let rawContent = responseMessage.content || "I'm sorry, I didn't understand.";
    rawContent = rawContent.replace(/<function[^>]*>[\s\S]*?<\/function>/g, '');
    rawContent = rawContent.trim();
    
    // Save to memory
    await saveChatMemory(businessId, senderPhone, message, rawContent);
    return rawContent;
  } catch (error) {
    console.error('AI Agent Error:', error);
    return "I'm sorry, I'm experiencing technical difficulties right now.";
  }
}

async function saveChatMemory(businessId: string, phone: string, userMessage: string, assistantMessage: string) {
  try {
    await supabase.from('whatsapp_chat_history').insert([
      { business_id: businessId, customer_phone: phone, role: 'user', content: userMessage },
      { business_id: businessId, customer_phone: phone, role: 'assistant', content: assistantMessage }
    ]);
  } catch(e) {
    console.error('Error saving chat history', e);
  }
}

async function clearChatMemory(phone: string) {
  try {
    await supabase.from('whatsapp_chat_history').delete().eq('customer_phone', phone);
  } catch(e) {
    console.error('Error clearing chat history', e);
  }
}

async function checkAvailability(date: string, startTime: string, durationMinutes: number, businessId: string): Promise<string> {
  // Fetch all tables for the business
  const { data: business } = await supabase.from('businesses').select('tables').eq('id', businessId).single();
  if (!business || !business.tables) return "No tables configured for this club.";
  
  const allTables = business.tables.map((t: any) => t.id);
  
  // Fetch existing bookings for that date
  const { data: bookings } = await supabase.from('bookings')
    .select('table_id, start_time, duration_minutes')
    .eq('business_id', businessId)
    .eq('booking_date', date)
    .in('status', ['confirmed']);
    
  if (!bookings || bookings.length === 0) {
    return `Available tables: ${allTables.join(', ')}`;
  }
  
  // Helper to convert "HH:mm:ss" or "HH:mm" to minutes since midnight
  const toMinutes = (timeStr: string) => {
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };
  
  // Helper to format minutes to 12-hour time (e.g. 1080 -> "6:00 PM")
  const to12Hour = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${period}`;
  };

  const reqStart = toMinutes(startTime);
  const reqEnd = reqStart + durationMinutes;
  
  // Track booked tables and their end times for "Next Available Slot" logic
  const occupiedTables = new Set<string>();
  const nextSlots: { table: string, freeAt: number }[] = [];
  
  for (const b of bookings) {
    const bStart = toMinutes(b.start_time);
    const bEnd = bStart + (b.duration_minutes || 60);
    
    // Check for overlap: max(start1, start2) < min(end1, end2)
    if (Math.max(reqStart, bStart) < Math.min(reqEnd, bEnd)) {
      occupiedTables.add(b.table_id);
      // This table frees up at bEnd
      nextSlots.push({ table: b.table_id, freeAt: bEnd });
    }
  }
  
  const availableTables = allTables.filter((t: string) => !occupiedTables.has(t));
  
  if (availableTables.length > 0) {
    return `Available tables: ${availableTables.join(', ')}`;
  }
  
  // If no tables available, suggest next slots
  if (nextSlots.length > 0) {
    // Sort by soonest available
    nextSlots.sort((a, b) => a.freeAt - b.freeAt);
    
    // Pick the earliest 2 options
    const uniqueSlots = Array.from(new Set(nextSlots.map(s => s.freeAt))).slice(0, 2);
    
    let nextSlotStr = `No tables are available exactly at ${startTime}. The next available slots are:\n`;
    uniqueSlots.forEach(time => {
      const tablesAtThisTime = nextSlots.filter(s => s.freeAt === time).map(s => s.table);
      nextSlotStr += `- ${to12Hour(time)} (Tables: ${tablesAtThisTime.join(', ')})\n`;
    });
    
    return nextSlotStr;
  }
  
  return `No tables available at ${startTime} on ${date}.`;
}

async function createBooking(args: any, businessId: string, senderPhone: string): Promise<boolean> {
  const { data, error } = await supabase.from('bookings').insert({
    business_id: businessId,
    customer_name: args.customer_name,
    customer_phone: senderPhone, // Use verified phone number
    table_id: args.table_id,
    booking_date: args.date,
    start_time: args.start_time,
    duration_minutes: args.duration_minutes || 60,
    status: 'confirmed',
    source: 'whatsapp'
  }).select();
  
  if (error) {
    console.error('Booking Insert Error:', error);
    return false;
  }
  
  // Log to Google Sheets
  try {
    const { syncBookingToSheet } = require('./googleSheets');
    await syncBookingToSheet({
      id: data?.[0]?.id, // if supabase returns the inserted row
      business_id: businessId,
      customer_name: args.customer_name,
      table_id: args.table_id,
      booking_date: args.date,
      start_time: args.start_time,
      duration_minutes: args.duration_minutes
    }, businessId);
    
    await logActivityToSheet('WHATSAPP_BOOKING', {
      user: 'AI Agent',
      table: args.table_id,
      details: `Booked for ${args.customer_name} (${senderPhone}) on ${args.date} at ${args.start_time}`
    }, businessId);
  } catch(e) {}
  
  return true;
}
