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
    
    // Check if enabled (default true if not explicitly false)
    if (qpulseConfig.enabled === false) return null;

    // We fetch a few high-level metrics for the insight
    // Current month start
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: sessionCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    // Choose insight based on data
    if (sessionCount !== null && sessionCount > 10) {
      return {
        dashboard: {
          message: "You're building strong momentum.",
          stat: `${sessionCount} sessions completed this month.`,
          subtext: "Keep the momentum going."
        },
        telegram: `You completed ${sessionCount} sessions this month.\nKeep the momentum going.`
      };
    }

    // Default motivational message if not enough data
    return {
      dashboard: {
        message: "Consistency creates growth.",
        stat: `${sessionCount || 0} sessions completed this month.`,
        subtext: "Keep up the good work today!"
      },
      telegram: `Consistency creates growth.\nKeep up the good work today!`
    };

  } catch (error) {
    console.error('Error generating Qpulse insight:', error);
    return null;
  }
}
