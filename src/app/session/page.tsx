import { redirect } from 'next/navigation';
import { businessManager } from '@/lib/businessManager';
import { supabase } from '@/lib/supabaseClient';

// Legacy QR Code redirector for old printed QR codes (e.g. /session?table=P1&b=... or /session?table=SNOOKER_1&type=snooker)
export default async function LegacySessionRedirect({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; t?: string; type?: string; b?: string; business?: string; _scan?: string }>;
}) {
  const sp = await searchParams;
  const rawTableId = sp.table || sp.t;
  let businessId = sp.b || sp.business;

  if (!rawTableId) {
    redirect('/404');
  }

  const tableId = decodeURIComponent(rawTableId).trim();
  let business = null;

  if (businessId) {
    business = await businessManager.getBusinessBySlug(businessId);
    if (!business) {
      business = await businessManager.getBusiness(businessId);
    }
  }

  // If businessId was not in the QR URL (like in early generateStationQR scripts), resolve by table mapping
  if (!business) {
    // 1. Check if there is an active session for this table in DB
    const { data: activeSession } = await supabase
      .from('sessions')
      .select('business_id')
      .ilike('table_id', tableId)
      .eq('status', 'ACTIVE')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSession && activeSession.business_id) {
      business = await businessManager.getBusiness(activeSession.business_id);
    }

    // 2. Search across businesses whose configured tables match this tableId
    if (!business) {
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, business_name, tables');

      if (businesses && businesses.length > 0) {
        // Find business with matching table id or name
        const match = businesses.find((b: any) =>
          Array.isArray(b.tables) && b.tables.some((t: any) =>
            String(t.id).trim().toLowerCase() === tableId.toLowerCase() ||
            String(t.name).trim().toLowerCase() === tableId.toLowerCase()
          )
        );
        if (match) {
          business = await businessManager.getBusiness(match.id);
        }
      }
    }
  }

  if (!business) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-200 dark:border-red-800/30 text-center w-full max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">QR Code Link Expired or Invalid</h1>
          <p className="text-gray-600 dark:text-gray-400">Could not resolve the business for table &quot;{tableId}&quot;. Please ask the reception desk for assistance.</p>
        </div>
      </main>
    );
  }

  // Canonicalize table ID if matched in config
  let canonicalTableId = tableId;
  const matchedTable = business.tables?.find((t: any) =>
    String(t.id).trim().toLowerCase() === tableId.toLowerCase() ||
    String(t.name).trim().toLowerCase() === tableId.toLowerCase()
  );
  if (matchedTable) {
    canonicalTableId = matchedTable.id;
  }

  const slug = (business.business_name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || business.id;

  const queryParams = new URLSearchParams();
  if (sp.type) queryParams.set('type', sp.type);
  if (sp._scan) queryParams.set('_scan', sp._scan);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  // Redirect to the clean URL structure
  redirect(`/qr/${slug}/${encodeURIComponent(canonicalTableId)}${queryString}`);
}
