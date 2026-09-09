import { supabase } from '@/lib/supabaseClient';

export interface QpulseInsight {
  dashboard: {
    message: string;
    stat: string;
    subtext: string;
  };
  telegram: string;
}

export async function generateQpulseInsight(businessId: string): Promise<QpulseInsight | null> {
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('qpulse_config')
      .eq('id', businessId)
      .single();

    if (!business || !business.qpulse_config) return null;

    const qpulseConfig = business.qpulse_config as any;
    if (qpulseConfig.enabled === false) return null;

    // Fetch last 30 days of completed sessions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: sessions } = await supabase
      .from('sessions')
      .select('cost, game_type, date, start_time')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .gte('date', dateStr);

    if (!sessions || sessions.length === 0) {
      return {
        dashboard: {
          message: "Consistency creates growth.",
          stat: "No completed sessions yet.",
          subtext: "Keep up the good work today!"
        },
        telegram: "Consistency creates growth.\nKeep up the good work today!"
      };
    }

    const totalRevenue = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    const avgSessionValue = Math.round(totalRevenue / sessions.length);

    const gameCounts: Record<string, number> = {};
    const dayCounts: Record<number, number> = {};

    sessions.forEach(s => {
      if (s.game_type) {
        gameCounts[s.game_type] = (gameCounts[s.game_type] || 0) + 1;
      }
      if (s.date) {
        const dayOfWeek = new Date(s.date).getDay();
        dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
      }
    });

    const bestGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const bestDayNum = parseInt(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const busiestDay = days[bestDayNum];

    // Randomly select an insight to show to keep it fresh
    const insights = [
      {
        message: "Revenue is flowing.",
        stat: `₹${totalRevenue.toLocaleString('en-IN')} generated over the last 30 days.`,
        subtext: `Your average session value is ₹${avgSessionValue.toLocaleString('en-IN')}.`,
        telegram: `Revenue Insight: You've generated ₹${totalRevenue.toLocaleString('en-IN')} over the last 30 days with an average session value of ₹${avgSessionValue.toLocaleString('en-IN')}.`
      },
      {
        message: "Optimize your schedule.",
        stat: `${busiestDay} is your busiest day.`,
        subtext: "Consider adding promotions on slower days to balance footfall.",
        telegram: `Traffic Insight: ${busiestDay} is your busiest day. Consider adding promotions on slower days to balance footfall.`
      },
      {
        message: "Player preferences.",
        stat: `${bestGame.toUpperCase()} is your best-performing game type.`,
        subtext: "Ensure these tables or consoles are well-maintained for maximum uptime.",
        telegram: `Activity Insight: ${bestGame.toUpperCase()} is your best-performing game type recently.`
      }
    ];

    // Cycle based on current hour to ensure it changes throughout the day
    const currentHour = new Date().getHours();
    const selectedInsight = insights[currentHour % insights.length];

    return {
      dashboard: {
        message: selectedInsight.message,
        stat: selectedInsight.stat,
        subtext: selectedInsight.subtext
      },
      telegram: selectedInsight.telegram
    };

  } catch (error) {
    console.error('Error generating Qpulse insight:', error);
    return null;
  }
}
