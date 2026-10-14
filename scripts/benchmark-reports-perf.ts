import { supabase } from '../src/lib/supabaseClient';
import { getFinancialReportsSummary } from '../src/lib/services/reportsService';

async function runBenchmark() {
  console.log('\n============================================================');
  console.log('⚡ BENCHMARKING REPORTS & KPIS ENDPOINT PERFORMANCE');
  console.log('============================================================\n');

  const { data: businesses } = await supabase.from('businesses').select('id, business_name').limit(1);
  if (!businesses || businesses.length === 0) throw new Error('No business found');
  const bId = businesses[0].id;

  const iterations = 20;
  const latencies: number[] = [];

  console.log(`Running ${iterations} iterations of getFinancialReportsSummary for business: ${businesses[0].business_name}...`);

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await getFinancialReportsSummary(bId, 'thisMonth', undefined, undefined, true);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0].toFixed(1);
  const max = latencies[latencies.length - 1].toFixed(1);
  const avg = (latencies.reduce((a, b) => a + b, 0) / iterations).toFixed(1);
  const p50 = latencies[Math.floor(iterations * 0.5)].toFixed(1);
  const p95 = latencies[Math.floor(iterations * 0.95)].toFixed(1);

  console.log('\nResults:');
  console.log(`  Min: ${min} ms`);
  console.log(`  Avg: ${avg} ms`);
  console.log(`  p50: ${p50} ms`);
  console.log(`  p95: ${p95} ms`);
  console.log(`  Max: ${max} ms`);
  console.log('\nTarget: p95 under 1,000 ms -> ' + (parseFloat(p95) < 1000 ? '✅ MET (SUB-SECOND)' : '❌ EXCEEDED'));
  console.log('============================================================\n');
}

runBenchmark().catch(console.error);
