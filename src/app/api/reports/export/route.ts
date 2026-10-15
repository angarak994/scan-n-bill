import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { resolveReportRange, ReportPreset } from '@/lib/services/reportsDateUtils';
import { getBusinessTimezone, DEFAULT_BUSINESS_TIMEZONE, formatTimeInTimezone, formatDateInTimezone } from '@/lib/sheetsTimezone';

export const dynamic = 'force-dynamic';

/**
 * Sanitizes a string for CSV to prevent Formula Injection (CSV Injection / CWE-1236)
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);

  // If the cell begins with dangerous formula triggers, prefix with a single quote
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(safeStr)) {
    safeStr = `'${safeStr}`;
  }

  // Escape internal double quotes by doubling them
  const escaped = safeStr.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.businessId;
    const { searchParams } = new URL(request.url);

    const period = (searchParams.get('period') || 'thisMonth') as ReportPreset;
    const customStart = searchParams.get('startDate') || undefined;
    const customEnd = searchParams.get('endDate') || undefined;

    // Fetch business for timezone (Cached in memory with 60s TTL)
    const business = await businessManager.getBusiness(businessId);
    const timezone = getBusinessTimezone(business) || DEFAULT_BUSINESS_TIMEZONE;

    // Resolve date boundaries
    const range = resolveReportRange(period, customStart, customEnd, new Date(), timezone);

    // Fetch completed sessions in date range
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        date,
        start_time,
        end_time,
        customer_name,
        game_type,
        duration,
        base_cost,
        food_cost,
        discount_amount,
        cost,
        payment_status,
        completed_by,
        created_at
      `)
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .gte('end_time', range.current.startIso)
      .lt('end_time', range.current.endIso)
      .order('end_time', { ascending: false });

    if (error) {
      throw error;
    }

    const headers = [
      'Session ID',
      'Date',
      'Time',
      'Customer',
      'Service/Game',
      'Duration',
      'Table Cost',
      'Food & Bev Cost',
      'Discount',
      'Total Billed',
      'Payment Status',
      'Completed By'
    ];

    const rows = (sessions || []).map((s: any) => {
      const shortId = s.id ? s.id.slice(0, 8).toUpperCase() : '';
      const dateStr = formatDateInTimezone(s.end_time || s.created_at, timezone);
      const timeStr = formatTimeInTimezone(s.end_time || s.created_at, timezone);
      const tableCost = Math.max(0, (Number(s.base_cost) || Number(s.cost) || 0) - (Number(s.food_cost) || 0));
      const foodCost = Number(s.food_cost) || 0;
      const discount = Number(s.discount_amount) || 0;
      const totalBilled = Number(s.cost) || (tableCost + foodCost - discount);

      return [
        sanitizeCsvCell(shortId),
        sanitizeCsvCell(dateStr),
        sanitizeCsvCell(timeStr),
        sanitizeCsvCell(s.customer_name || 'Walk-in'),
        sanitizeCsvCell(s.game_type || 'Pool'),
        sanitizeCsvCell(s.duration || '—'),
        sanitizeCsvCell(tableCost),
        sanitizeCsvCell(foodCost),
        sanitizeCsvCell(discount),
        sanitizeCsvCell(totalBilled),
        sanitizeCsvCell(s.payment_status || 'Paid'),
        sanitizeCsvCell(s.completed_by || 'System')
      ].join(',');
    });

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
    const filename = `revenue_report_${range.current.start.toISOString().split('T')[0]}_to_${range.current.end.toISOString().split('T')[0]}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('[reports/export] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export CSV report' },
      { status: 500 }
    );
  }
}
