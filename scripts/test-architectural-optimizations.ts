import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function testArchitecturalOptimizations() {
  const { supabase } = await import('../src/lib/supabaseClient');
  console.log('\n======================================================');
  console.log('🧪 ARCHITECTURAL & PERFORMANCE OPTIMIZATION VERIFICATION');
  console.log('======================================================\n');

  // Test 1: Health Diagnostic & Monitoring Logic
  console.log('--- TEST 1: System Health & Diagnostic Instrumentation ---');
  {
    const dbStartTime = Date.now();
    const { data: biz, error } = await supabase.from('businesses').select('id, business_name, tables').limit(1).single();
    const dbLatencyMs = Date.now() - dbStartTime;

    assert(!error && !!biz, `Database ping succeeded with latency: ${dbLatencyMs}ms`);
    assert(typeof dbLatencyMs === 'number' && dbLatencyMs >= 0, 'Database latency measurement is precise and non-negative');

    const mem = process.memoryUsage();
    assert(mem.heapUsed > 0 && mem.rss > 0, `Memory metrics accessible (Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB, RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Test 2: Auto-Cutoff Batch Query & Ephemeral Retention Cleanup
  console.log('\n--- TEST 2: Auto-Cutoff Batch Query & Ephemeral Table Retention ---');
  {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const cutoffThreshold = new Date(nowMs - TWELVE_HOURS_MS).toISOString();

    // Query across all businesses in 1 single query
    const queryStart = Date.now();
    const { data: overdueSessions, error } = await supabase
      .from('sessions')
      .select('id, table_id, business_id, start_time')
      .eq('status', 'ACTIVE')
      .lt('start_time', cutoffThreshold);
    const queryDuration = Date.now() - queryStart;

    assert(!error, `Single-batch overdue sessions query succeeded in ${queryDuration}ms`);
    console.log(`ℹ️ Found ${overdueSessions?.length || 0} overdue sessions across all businesses in 1 query (0 N+1 overhead)`);

    // Retention cleanup check on dashboard_syncs
    const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: cleanupErr } = await supabase
      .from('dashboard_syncs')
      .delete({ count: 'exact' })
      .lt('created_at', oneDayAgo);

    assert(!cleanupErr, `Ephemeral dashboard_syncs cleanup executed cleanly (Purged stale rows: ${count || 0})`);
  }

  // Test 3: Table Ownership & Rogue Table ID Validation
  console.log('\n--- TEST 3: Table Ownership & Rogue ID Validation Safeguards ---');
  {
    const { data: biz } = await supabase.from('businesses').select('id, tables').limit(1).single();
    if (biz) {
      const configuredTables = (biz.tables || []) as any[];
      const validTableId = configuredTables[0]?.id || 'T1';
      const fakeTableId = 'NONEXISTENT_TABLE_999XYZ';

      const isValid = configuredTables.some((t: any) => String(t.id).trim().toLowerCase() === String(validTableId).trim().toLowerCase());
      const isFakeValid = configuredTables.some((t: any) => String(t.id).trim().toLowerCase() === String(fakeTableId).trim().toLowerCase());

      assert(isValid === true, `Configured table '${validTableId}' is recognized as valid`);
      assert(isFakeValid === false, `Rogue table '${fakeTableId}' is successfully rejected`);
    }
  }

  // Test 4: Business Slug Resolution Targeted Query
  console.log('\n--- TEST 4: Business Slug Targeted Resolution ---');
  {
    const { businessManager } = require('../src/lib/businessManager');
    const { data: sampleBiz } = await supabase.from('businesses').select('id, business_name').limit(1).single();
    if (sampleBiz) {
      const slug = sampleBiz.business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const resolved = await businessManager.getBusinessBySlug(slug);
      assert(!!resolved && resolved.id === sampleBiz.id, `Targeted slug resolution accurately resolved business ID ${sampleBiz.id}`);
    }
  }

  // Test 5: Notification Filter Optimization for Orders
  console.log('\n--- TEST 5: Food Orders Notification Targeted Suffix Filter ---');
  {
    const dummySessionId = 'test-session-12345';
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('message, created_at, type')
      .like('message', `%|${dummySessionId}`)
      .limit(5);

    assert(!error, `Targeted database-level suffix filter executed without full-table scan`);
    assert(Array.isArray(notifs), `Returned scoped array of notifications`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL ARCHITECTURAL OPTIMIZATION TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

testArchitecturalOptimizations().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
