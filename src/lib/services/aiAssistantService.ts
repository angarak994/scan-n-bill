import { supabase } from '@/lib/supabaseClient';

export async function processAIQuery(query: string, businessId: string): Promise<string> {
  try {
    const q = query.toLowerCase();

    // Intent 1: Busiest time / Peak hours
    if (q.includes('busiest') || q.includes('peak') || q.includes('utilization')) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('date')
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (!sessions || sessions.length === 0) {
        return "I don't have enough data from the last 30 days to determine your busiest times yet.";
      }

      const dayCounts: Record<number, number> = {};
      sessions.forEach(s => {
        if (s.date) {
          const day = new Date(s.date).getDay();
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        }
      });
      const bestDayNum = parseInt(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '0');
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      return `Based on data from the last 30 days, **${days[bestDayNum]}** is your busiest day. I recommend ensuring you have adequate staffing on this day to handle peak utilization.`;
    }

    // Intent 2: Top customers / Loyalty
    if (q.includes('top customer') || q.includes('who are my') || q.includes('loyalty')) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('customer_phone, cost')
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED')
        .not('customer_phone', 'is', null)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (!sessions || sessions.length === 0) {
        return "You don't have any recorded customers in the last 30 days.";
      }

      const customerTotals: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.customer_phone) {
          customerTotals[s.customer_phone] = (customerTotals[s.customer_phone] || 0) + (s.cost || 0);
        }
      });
      
      const sorted = Object.entries(customerTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (sorted.length === 0) return "Not enough customer data to identify top spenders.";

      let msg = "Your top customers over the last 30 days are:\n\n";
      sorted.forEach((c, i) => {
        msg += `${i + 1}. **${c[0]}** (₹${c[1].toLocaleString('en-IN')})\n`;
      });
      msg += "\n✨ Recommendation: Consider offering them a 10% discount on their next visit to build loyalty.";
      return msg;
    }

    // Intent 3: Revenue / Performance
    if (q.includes('revenue') || q.includes('perform') || q.includes('sales')) {
      const today = new Date();
      const last7DaysDate = new Date(); last7DaysDate.setDate(today.getDate() - 7);
      const previous7DaysDate = new Date(); previous7DaysDate.setDate(today.getDate() - 14);

      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('cost')
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED')
        .gte('date', last7DaysDate.toISOString().split('T')[0]);
      
      const { data: pastSessions } = await supabase
        .from('sessions')
        .select('cost')
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED')
        .gte('date', previous7DaysDate.toISOString().split('T')[0])
        .lt('date', last7DaysDate.toISOString().split('T')[0]);
        
      const recentRev = (recentSessions || []).reduce((sum, s) => sum + (s.cost || 0), 0);
      const pastRev = (pastSessions || []).reduce((sum, s) => sum + (s.cost || 0), 0);
      
      if (recentRev === 0 && pastRev === 0) return "No revenue recorded in the last 14 days.";
      
      const diff = pastRev === 0 ? 100 : Math.round(((recentRev - pastRev) / pastRev) * 100);
      const trendStr = diff >= 0 ? `**${diff}% higher**` : `**${Math.abs(diff)}% lower**`;

      return `Over the last 7 days, your revenue was **₹${recentRev.toLocaleString('en-IN')}**. This is ${trendStr} compared to the previous 7 days.\n\n✨ Focus on driving more repeat bookings through WhatsApp to keep this momentum going.`;
    }

    // Default Fallback
    return "I am currently analyzing your data for insights on revenue, busiest times, and top customers. Ask me something like: 'What is our busiest time?' or 'Who are my top customers?'";
  } catch (error) {
    console.error('Error in AI Assistant:', error);
    return "I'm having trouble analyzing your data right now. Please try again later.";
  }
}
