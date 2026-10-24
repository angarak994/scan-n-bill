import { getTableStatus } from '../../../../lib/sessionManager';
import SessionClient from './SessionClient';
import { businessManager } from '../../../../lib/businessManager';

export default async function SessionPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ businessSlug: string, tableId: string }>;
  searchParams: Promise<{ type?: string; _scan?: string }>; 
}) {
  const p = await params;
  const sp = await searchParams;
  const rawTableId = p.tableId;
  const table_id = decodeURIComponent(rawTableId).trim();
  const game_type = sp.type;
  const scanNonce = sp._scan;

  // Resolve business by slug or ID
  const business = await businessManager.getBusinessBySlug(p.businessSlug);
  const business_id = business?.id;

  if (!business_id) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-200 dark:border-red-800/30 text-center w-full max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">Oops!</h1>
          <p className="text-gray-600 dark:text-gray-400">Business not found or invalid URL</p>
        </div>
      </main>
    );
  }

  // Developer-controlled feature entitlement & lifecycle validation
  const { isOperationalStatus, hasFeature } = await import('../../../../lib/entitlements');
  const isApproved = isOperationalStatus(business?.status);
  const isQrEnabled = await hasFeature(business_id, 'qr_sessions');

  if (!isApproved || !isQrEnabled) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-800/30 text-center w-full max-w-md">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">QR Sessions Inactive</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            Self-service QR session scanning is currently inactive for this venue. Please contact the club desk for manual table start and scoring.
          </p>
        </div>
      </main>
    );
  }


  let initialState: any = { status: 'loading' };

  try {
    const data = await getTableStatus(table_id, business_id);
    if (data.status === 'idle') {
      initialState = { 
        status: 'idle', 
        table_id, 
        game_type: data.game_type || game_type || 'unknown', 
        pricingRules: data.pricingRules,
        businessName: (data.businessName || business?.business_name || '').trim(),
        tableName: data.tableName,
        max_players: data.max_players,
        qpayConfig: data.qpayConfig,
        paymentQrConfig: data.paymentQrConfig,
        menuItems: data.menuItems,
      };
    } else if (data.status === 'active') {
      const activeState = {
        id: data.id,
        customer_name: data.customer_name,
        table_id: data.table_id,
        game_type: data.game_type,
        date: data.date,
        start_time: data.start_time,
        pricingRules: data.pricingRules,
        businessName: (data.businessName || business?.business_name || '').trim(),
        tableName: data.tableName,
        max_players: data.max_players,
        qpayConfig: data.qpayConfig,
        paymentQrConfig: data.paymentQrConfig,
        food_cost: data.food_cost,
        num_players: data.num_players,
        discount: data.discount,
        menuItems: data.menuItems,
        paused_at: data.paused_at,
        paused_duration_seconds: data.paused_duration_seconds,
        locked_rate: data.locked_rate,
        locked_rate_name: data.locked_rate_name,
      };
      initialState = {
        ...activeState,
        status: 'active',
      };
    }
  } catch (err: any) {
    initialState = { status: 'error', message: err.message || 'Failed to load table status' };
  }

  return <SessionClient initialState={initialState} business_id={business_id} table_id={table_id} game_type={game_type} />;
}
