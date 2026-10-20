import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';
import OpenAI from 'openai';

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

export async function processAIQuery(query: string, businessId: string): Promise<string> {
  const lower = query.toLowerCase().trim();
  const todayStr = getCurrentISTDateStr();

  // Authoritative Direct Answers for core owner questions (Zero Hallucination)
  try {
    // 1. "How much did we earn today?" / "Today's revenue"
    if (lower.includes('earn today') || lower.includes("today's revenue") || lower.includes('todays revenue') || lower.includes('earnings today')) {
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('cost, food_cost, payment_status')
        .eq('business_id', businessId)
        .eq('date', todayStr)
        .eq('status', 'COMPLETED');

      const rev = (todaySessions || []).reduce((sum, s) => sum + Number(s.cost || 0), 0);
      const foodRev = (todaySessions || []).reduce((sum, s) => sum + Number(s.food_cost || 0), 0);
      const count = todaySessions?.length || 0;

      return `📊 **Today's Financial Summary (${todayStr}):**\n\n- **Table Revenue:** ₹${rev.toLocaleString('en-IN')}\n- **F&B Revenue:** ₹${foodRev.toLocaleString('en-IN')}\n- **Total Completed Sessions:** ${count}\n- **Total Revenue:** **₹${(rev + foodRev).toLocaleString('en-IN')}**`;
    }

    // 2. "Which tables are free right now?" / "Available tables"
    if (lower.includes('free right now') || lower.includes('available tables') || lower.includes('tables free') || lower.includes('empty table')) {
      const business = await businessManager.getBusiness(businessId);
      const allTables = business?.tables || [];

      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('table_id, customer_name, start_time')
        .eq('business_id', businessId)
        .eq('status', 'ACTIVE');

      const activeTableIds = new Set((activeSessions || []).map(s => s.table_id));
      const freeTables = allTables.filter((t: any) => !activeTableIds.has(t.id));

      if (freeTables.length === 0) {
        return `⚠️ All **${allTables.length} tables** are currently occupied by live sessions right now.`;
      }

      const tableList = freeTables.map((t: any) => `• **${t.name || t.id}** (${(t.game_type || t.type || 'pool').toUpperCase()})`).join('\n');
      return `🟢 **${freeTables.length} Free Table(s) Right Now:**\n\n${tableList}\n\nOccupied tables: ${activeSessions?.length || 0} / ${allTables.length}`;
    }

    // 3. "Show me today's cancellations" / "Cancellations"
    if (lower.includes('cancellation') || lower.includes('cancelled')) {
      const { data: cancelledBookings } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_phone, start_time, game_type, table_id')
        .eq('business_id', businessId)
        .eq('booking_date', todayStr)
        .eq('status', 'cancelled');

      if (!cancelledBookings || cancelledBookings.length === 0) {
        return `✅ **No cancellations today!** All scheduled bookings are active or confirmed.`;
      }

      let list = `❌ **${cancelledBookings.length} Cancelled Booking(s) Today (${todayStr}):**\n\n`;
      cancelledBookings.forEach((b, idx) => {
        list += `${idx + 1}. **QC-${b.id.substring(0, 6).toUpperCase()}** — ${b.customer_name} (${b.game_type.toUpperCase()}) on Table ${b.table_id} at ${b.start_time.substring(0, 5)}\n`;
      });
      return list.trim();
    }

    // 4. "Why did my WhatsApp reminder fail?" / "Failed messages"
    if (lower.includes('why did') || lower.includes('failed') || lower.includes('reminder fail') || lower.includes('whatsapp fail')) {
      const { data: failedMsgs } = await supabase
        .from('whatsapp_messages')
        .select('recipient_name, recipient_phone, error_message, content, created_at')
        .eq('business_id', businessId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(3);

      if (!failedMsgs || failedMsgs.length === 0) {
        return `✅ You have **no recorded message delivery failures** for this business! All outbound messages were accepted by the provider.`;
      }

      let msg = `⚠️ **Recent WhatsApp Delivery Failure(s):**\n\n`;
      failedMsgs.forEach((f, idx) => {
        msg += `${idx + 1}. **To:** ${f.recipient_name} (+${f.recipient_phone})\n• **Reason:** ${f.error_message || 'Recipient phone number is invalid or provider temporarily throttled the request.'}\n• **Time:** ${new Date(f.created_at).toLocaleTimeString('en-IN')}\n\n`;
      });
      msg += `💡 **Next Step:** You can retry sending from the **Delivery Logs** tab in Messaging.`;
      return msg.trim();
    }

    // 5. "Summarize yesterday's business"
    if (lower.includes('yesterday')) {
      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

      const { data: ySessions } = await supabase
        .from('sessions')
        .select('cost, food_cost')
        .eq('business_id', businessId)
        .eq('date', yesterdayStr)
        .eq('status', 'COMPLETED');

      const rev = (ySessions || []).reduce((sum, s) => sum + Number(s.cost || 0), 0);
      const foodRev = (ySessions || []).reduce((sum, s) => sum + Number(s.food_cost || 0), 0);

      return `📊 **Yesterday's Performance (${yesterdayStr}):**\n\n- **Table Revenue:** ₹${rev.toLocaleString('en-IN')}\n- **F&B Revenue:** ₹${foodRev.toLocaleString('en-IN')}\n- **Total Revenue:** **₹${(rev + foodRev).toLocaleString('en-IN')}**\n- **Completed Sessions:** ${ySessions?.length || 0}`;
    }
  } catch (err) {
    console.warn('Error during direct query evaluation in AI assistant:', err);
  }

  // Fallback to LLM for general business analysis questions
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: sessions } = await supabase
      .from('sessions')
      .select('date, cost, customer_phone, start_time, duration_minutes')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .gte('date', dateStr);

    let totalRevenue = 0;
    (sessions || []).forEach(s => {
      totalRevenue += Number(s.cost || 0);
    });

    const context = `Business Data (Last 30 Days): Total Revenue: ₹${totalRevenue}, Total Completed Sessions: ${(sessions || []).length}`;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are an AI Business Analyst for QControl. Context: ${context}. Answer concisely.` },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return (response.choices[0].message.content || 'Analysis complete.').trim();
  } catch {
    return `I am currently analyzing verified database records for your club. You can ask for **today's revenue**, **free tables**, **today's cancellations**, or **why reminders failed**.`;
  }
}
