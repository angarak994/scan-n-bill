import { supabase } from '@/lib/supabaseClient';

export async function processAssistantMessage(globalCustomer: any, text: string, platform: string): Promise<string> {
    const lowerText = text.toLowerCase();
    
    // 1. Availability Intent
    if (lowerText.includes('available') || lowerText.includes('table')) {
        return "I can check real-time availability for you! Which location or business are you looking to play at?";
    }
    
    // 2. Booking Intent
    if (lowerText.includes('book') || lowerText.includes('reserve')) {
        return "I can help you book a table. Please let me know the location and time.";
    }
    
    // 3. Loyalty / QPoints Intent
    if (lowerText.includes('points') || lowerText.includes('loyalty')) {
        // Look up loyalty points across all businesses they play at
        const { data: profiles } = await supabase
            .from('customers')
            .select('loyalty_points, business_id')
            .eq('global_customer_id', globalCustomer.id);
            
        if (!profiles || profiles.length === 0) {
            return "You don't have any QPoints yet. Start playing at any QControl partnered venue to earn rewards!";
        }
        
        let totalPoints = profiles.reduce((sum, p) => sum + Number(p.loyalty_points), 0);
        return `You have a total of ${totalPoints} QPoints across your favorite venues! 🏆`;
    }
    
    // Default fallback (AI could take over here)
    return "Hi! I am your QControl Assistant. I can help you find available tables, book sessions, and check your QPoints. What do you need help with?";
}

/**
 * Foundation for Smart Insights (Win-back, Retention)
 * Called by a daily cron job
 */
export async function generateRetentionInsights(businessId: string) {
    // Detect customers who haven't visited in 30 days but were regulars
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: atRiskCustomers } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .gte('total_sessions', 5)
        .lt('updated_at', thirtyDaysAgo);
        
    // In the future, we would automatically queue personalized WhatsApp win-back messages for these customers
    return atRiskCustomers || [];
}
