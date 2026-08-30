import { getTableStatus } from '../../lib/sessionManager';
import SessionClient from './SessionClient';

export default async function SessionPage({ searchParams }: { searchParams: Promise<{ table?: string; type?: string; b?: string; _scan?: string }> }) {
  const params = await searchParams;
  const table_id = params.table;
  const game_type = params.type;
  const business_id = params.b;
  const scanNonce = params._scan;

  if (!table_id) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-200 dark:border-red-800/30 text-center w-full max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">Oops!</h1>
          <p className="text-gray-600 dark:text-gray-400">Table ID is missing from URL</p>
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
        businessName: data.businessName 
      };
    } else if (data.status === 'active') {
      if (!scanNonce) {
        initialState = {
          status: 'prompt_end',
          id: data.id,
          table_id: data.table_id,
          game_type: data.game_type,
          businessName: data.businessName,
        };
      } else {
        initialState = {
          status: 'active',
          id: data.id,
          customer_name: data.customer_name,
          table_id: data.table_id,
          game_type: data.game_type,
          date: data.date,
          start_time: data.start_time,
          pricingRules: data.pricingRules,
          businessName: data.businessName,
        };
      }
    }
  } catch (err: any) {
    initialState = { status: 'error', message: err.message || 'Failed to load table status' };
  }

  return <SessionClient initialState={initialState} business_id={business_id} table_id={table_id} game_type={game_type} />;
}
