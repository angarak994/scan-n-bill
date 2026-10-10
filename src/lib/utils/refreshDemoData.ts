import { supabase } from '@/lib/supabaseClient';

/**
 * Safely updates the timestamps of a Demo Business's data to "Now"
 * so that when users log into the sandbox, the dashboard looks fresh and active.
 * It does NOT delete data, preserving any changes made by the user.
 */
export async function refreshDemoTimestamps(businessId: string) {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000).toISOString();
    
    // 1. Shift ACTIVE sessions to have started 30 to 60 mins ago
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE');
      
    if (activeSessions && activeSessions.length > 0) {
       for (let i = 0; i < activeSessions.length; i++) {
          const shift = i % 2 === 0 ? thirtyMinsAgo : oneHourAgo;
          await supabase.from('sessions')
             .update({ start_time: shift, date: todayDate })
             .eq('id', activeSessions[i].id);
       }
    }

    // 2. Shift 'confirmed' upcoming bookings to today
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'confirmed');
      
    if (bookings && bookings.length > 0) {
        for (let i = 0; i < bookings.length; i++) {
          const futureTime = new Date(now.getTime() + (i + 1) * 3600000).toTimeString().substring(0, 5); // i hours from now
          await supabase.from('bookings')
             .update({ booking_date: todayDate, start_time: futureTime })
             .eq('id', bookings[i].id);
       }
    }
    
    // 3. Shift recent COMPLETED sessions to today and yesterday so the dashboard has recent revenue data
    const { data: completed } = await supabase
       .from('sessions')
       .select('id')
       .eq('business_id', businessId)
       .eq('status', 'COMPLETED')
       .order('created_at', { ascending: false })
       .limit(5);
       
    if (completed && completed.length > 0) {
        const yesterdayDate = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
        for (let i = 0; i < completed.length; i++) {
            const targetDate = i < 2 ? todayDate : yesterdayDate;
            await supabase.from('sessions')
               .update({ date: targetDate })
               .eq('id', completed[i].id);
        }
    }
    
    // 4. Shift recent Payments to today/yesterday for the Financial Overview
    const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);
        
    if (payments && payments.length > 0) {
        const yesterdayDate = new Date(now.getTime() - 86400000).toISOString();
        for (let i = 0; i < payments.length; i++) {
            const targetDate = i < 2 ? now.toISOString() : yesterdayDate;
            await supabase.from('payments')
               .update({ created_at: targetDate })
               .eq('id', payments[i].id);
        }
    }

  } catch (err) {
    console.error('Error refreshing demo data timestamps', err);
  }
}
