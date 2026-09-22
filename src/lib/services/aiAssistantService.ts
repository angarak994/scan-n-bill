import { supabase } from '@/lib/supabaseClient';
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
  try {
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      return "My AI brain is currently offline because the API key is missing. Please configure your API key in the settings.";
    }

    // 1. Gather Context Data for the last 30 days
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
    const customerTotals: Record<string, number> = {};
    const dayCounts: Record<string, number> = {};
    const hourCounts: Record<string, number> = {};

    (sessions || []).forEach(s => {
      const cost = s.cost || 0;
      totalRevenue += cost;
      
      if (s.customer_phone) {
        customerTotals[s.customer_phone] = (customerTotals[s.customer_phone] || 0) + cost;
      }
      
      if (s.date) {
        const day = new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }

      if (s.start_time) {
        const hour = s.start_time.split(':')[0] + ':00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    const topCustomers = Object.entries(customerTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phone, total]) => ({ phone, total: `₹${total}` }));

    const context = `
      Business Data (Last 30 Days):
      - Total Revenue: ₹${totalRevenue}
      - Total Completed Sessions: ${(sessions || []).length}
      - Top 5 Customers by Spend: ${JSON.stringify(topCustomers)}
      - Sessions by Day of Week: ${JSON.stringify(dayCounts)}
      - Sessions by Hour of Day: ${JSON.stringify(hourCounts)}
    `;

    // 2. Call LLM
    const openai = getOpenAI();
    const systemPrompt = `You are a professional AI Business Analyst for a club/gaming business. 
You analyze the provided business data context and answer the owner's questions concisely and intelligently.
Be extremely helpful, friendly, and act as an expert advisor.
If the owner asks about something outside the provided data, politely inform them you only have access to the last 30 days of session, revenue, and customer data right now.

Formatting Rules:
- Use markdown (e.g. bold text for numbers, bullet points for lists).
- Keep responses short, actionable, and easy to read.
- Do NOT expose raw JSON data to the user. Present insights naturally.
- Highlight specific recommendations when possible (e.g., "Consider offering a discount to top customer X").

Context Data:
${context}
`;

    const response = await openai.chat.completions.create({
      model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    let content = response.choices[0].message.content || "I couldn't analyze the data at this moment.";
    
    // Clean up any potential markdown weirdness if needed
    return content.trim();

  } catch (error) {
    console.error('Error in AI Assistant:', error);
    return "I'm having trouble connecting to my analysis core right now. Please try again later.";
  }
}

