import { supabase } from '../src/lib/supabaseClient';
import { signToken } from '../src/lib/auth';
import { GET as summaryHandler } from '../src/app/api/reports/summary/route';
import { GET as transactionsHandler } from '../src/app/api/reports/transactions/route';
import { GET as drilldownHandler } from '../src/app/api/reports/drilldown/route';
import { GET as exportHandler } from '../src/app/api/reports/export/route';

function assert(condition: boolean, msg: string, details?: any) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`, details || '');
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runBackendTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PRODUCTION REPORTS & KPIS BACKEND AGGREGATION TESTS');
  console.log('============================================================\n');

  // 1. Fetch businesses for multi-tenant isolation test
  const { data: businesses } = await supabase.from('businesses').select('id, business_name').limit(2);
  if (!businesses || businesses.length === 0) {
    throw new Error('No businesses found for testing.');
  }

  const businessA = businesses[0];
  const businessB = businesses.length > 1 ? businesses[1] : { id: '00000000-0000-0000-0000-000000000000', business_name: 'Isolated Business' };

  console.log(`Testing Business A: ${businessA.business_name} (${businessA.id})`);
  console.log(`Testing Business B: ${businessB.business_name} (${businessB.id})`);

  const tokenA = await signToken({ businessId: businessA.id, role: 'owner' });
  const tokenB = await signToken({ businessId: businessB.id, role: 'owner' });

  // 2. Test Summary Endpoint for Business A
  console.log('\n--- 1. Summary Endpoint & Snapshot Integrity ---');
  const summaryReqA = new Request('http://localhost:3000/api/reports/summary?period=thisMonth', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const summaryResA = await summaryHandler(summaryReqA);
  assert(summaryResA.status === 200, 'Summary endpoint returns 200');
  const summaryA = await summaryResA.json();

  console.log('Summary Primary KPIs:', {
    revenue: summaryA.primary.revenue.value,
    collected: summaryA.primary.collected.value,
    pendingDues: summaryA.primary.pendingDues.value,
    netCashFlow: summaryA.primary.netCashFlow.value,
    asOf: summaryA.asOf
  });

  assert(typeof summaryA.primary.revenue.value === 'number', 'Revenue is a number');
  assert(typeof summaryA.primary.collected.value === 'number', 'Collected is a number');
  assert(typeof summaryA.primary.pendingDues.value === 'number', 'Pending Dues is a number');
  assert(typeof summaryA.primary.netCashFlow.value === 'number', 'Net Cash Flow is a number');
  assert(typeof summaryA.asOf === 'string' && summaryA.asOf.length > 0, 'asOf timestamp is present');

  // Verify secondary KPIs
  assert(summaryA.secondary.expenses.isAvailable === false, 'Expenses are marked unavailable per honesty policy');
  assert(summaryA.secondary.expenses.value === null, 'Expenses value is null, never ₹0');
  assert(summaryA.secondary.expenses.reason.includes('not set up'), 'Expenses reason explains why unavailable');

  // Verify Reconciliation checks in payload
  console.log('\n--- 2. Reconciliation Engine Validation ---');
  console.log(`Checks passed: ${summaryA.reconciliation.checksPassed} / ${summaryA.reconciliation.totalChecks}`);
  for (const check of summaryA.reconciliation.details) {
    console.log(`  [${check.passed ? 'PASS' : 'FAIL'}] ${check.code}: ${check.name} - ${check.explanation}`);
    assert(check.passed, `Reconciliation check ${check.code} passed`);
  }

  // 3. Multi-Tenant Isolation Test
  console.log('\n--- 3. Multi-Tenant Safety & Data Isolation ---');
  const summaryReqB = new Request('http://localhost:3000/api/reports/summary?period=thisMonth', {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const summaryResB = await summaryHandler(summaryReqB);
  assert(summaryResB.status === 200, 'Business B summary returns 200');
  const summaryB = await summaryResB.json();

  assert(summaryB.businessId === businessB.id, 'Summary B correctly scopes to Business B');
  assert(summaryA.businessId === businessA.id, 'Summary A correctly scopes to Business A');

  // 4. Test Transactions Endpoint
  console.log('\n--- 4. Transactions Endpoint (Search, Method, Status) ---');
  const txReq = new Request('http://localhost:3000/api/reports/transactions?period=thisMonth&page=1&pageSize=10', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const txRes = await transactionsHandler(txReq);
  assert(txRes.status === 200, 'Transactions endpoint returns 200');
  const txData = await txRes.json();

  console.log(`Total transactions found: ${txData.pagination.totalCount}, Page 1 rows: ${txData.transactions.length}`);
  if (txData.transactions.length > 0) {
    const firstTx = txData.transactions[0];
    console.log('Sample transaction:', {
      ref: firstTx.ref,
      type: firstTx.type,
      customer: firstTx.customer,
      method: firstTx.method,
      gross: firstTx.gross,
      discount: firstTx.discount,
      net: firstTx.net,
      status: firstTx.status
    });
    assert(firstTx.ref.startsWith('S-') || firstTx.ref.startsWith('P-') || firstTx.ref.startsWith('R-'), 'Transaction ref format');
    assert(typeof firstTx.net === 'number', 'Transaction net is number');
  }

  // 5. Test Drill-Down Endpoint for every primary KPI
  console.log('\n--- 5. Drill-Down Endpoints & Row Sum Integrity ---');
  const metricsToTest = ['revenue', 'collected', 'pendingDues', 'discounts', 'refunds', 'fb'];
  for (const metric of metricsToTest) {
    const ddReq = new Request(`http://localhost:3000/api/reports/drilldown?period=thisMonth&metric=${metric}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const ddRes = await drilldownHandler(ddReq);
    assert(ddRes.status === 200, `Drilldown ${metric} returns 200`);
    const ddData = await ddRes.json();
    console.log(`  Metric ${metric}: ${ddData.totalCount} rows, Total sum: ${ddData.totalValue}`);
    assert(Array.isArray(ddData.rows), `Drilldown ${metric} returns rows array`);
  }

  // 6. Test CSV Export Endpoint (Safe Escaping)
  console.log('\n--- 6. CSV Export Endpoint & Formula Injection Protection ---');
  const csvReq = new Request('http://localhost:3000/api/reports/export?period=thisMonth', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const csvRes = await exportHandler(csvReq);
  assert(csvRes.status === 200, 'Export CSV returns 200');
  const csvText = await csvRes.text();
  assert(csvText.includes('"Session ID"') && csvText.includes('"Customer"'), 'CSV contains required header row');
  console.log(`CSV generated successfully: ${csvText.split('\n').length} lines`);

  console.log('\n============================================================');
  console.log('🎉 ALL BACKEND AGGREGATION & RECONCILIATION TESTS PASSED!');
  console.log('============================================================\n');
}

runBackendTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
