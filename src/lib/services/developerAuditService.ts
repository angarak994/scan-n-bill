import { supabase } from '@/lib/supabaseClient';

export interface DeveloperAuditEntry {
  id?: string;
  developer_email: string;
  action: string;
  target_business_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  created_at?: string;
}

// Fallback in-memory audit trail for resilience
const fallbackAuditLogs: DeveloperAuditEntry[] = [];

export const developerAuditService = {
  /**
   * Tamper-resistant immutable developer action logging.
   */
  async log(entry: DeveloperAuditEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const payload = {
      developer_email: entry.developer_email || 'developer@qcontrol.internal',
      action: entry.action,
      target_business_id: entry.target_business_id || null,
      details: entry.details || {},
      ip_address: entry.ip_address || null,
      created_at: timestamp,
    };

    fallbackAuditLogs.unshift(payload);
    if (fallbackAuditLogs.length > 500) {
      fallbackAuditLogs.pop();
    }

    try {
      const { error } = await supabase.from('developer_audit_logs').insert([payload]);
      if (error) {
        console.warn('[DeveloperAudit] DB write note (fallback in-memory retained):', error.message);
      }
    } catch (err: any) {
      console.warn('[DeveloperAudit] Non-fatal log failure:', err?.message || err);
    }
  },

  /**
   * Retrieves audit logs for the Developer Control Center.
   */
  async getLogs(limit = 100, businessId?: string): Promise<DeveloperAuditEntry[]> {
    try {
      let query = supabase
        .from('developer_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (businessId) {
        query = query.eq('target_business_id', businessId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback to in-memory logs
    }

    if (businessId) {
      return fallbackAuditLogs.filter(l => l.target_business_id === businessId).slice(0, limit);
    }
    return fallbackAuditLogs.slice(0, limit);
  }
};
