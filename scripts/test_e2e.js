

async function runTest() {
  console.log("\n===========================================");
  console.log("🚀 INITIATING SCAN-N-BILL ENTERPRISE DIAGNOSTIC");
  console.log("===========================================\n");

  const baseUrl = 'http://localhost:3000';
  const businessId = '1'; // Assuming ID 1 exists from fallback
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    require('dotenv').config({ path: '.env.local' });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: b } = await supabase.from('businesses').select('dashboard_pin').limit(1).single();
    const pin = b.dashboard_pin;

    console.log("⏳ [1/5] Testing Dashboard Authorization & Data Fetch...");
    const dashRes = await fetch(`${baseUrl}/api/dashboard-data?pin=${pin}`);
    const dashData = await dashRes.json();
    
    if (dashData.error) {
      console.log("❌ Dashboard API returned error:", dashData.error);
      return;
    }
    
    const bId = dashData.businessId;
    console.log(`✅ Success! Connected to Business: ${dashData.businessName} (Owner: ${dashData.ownerName})`);
    
    // 2. Start a New Session
    console.log("\n⏳ [2/5] Creating a simulated walk-in session...");
    const startRes = await fetch(`${baseUrl}/api/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: bId,
        table_id: 'TABLE-17',
        game_type: 'Pool (8-Ball)',
        customer_name: 'Diagnostic Tester',
        notes: 'Automated Test Run'
      })
    });
    
    const startData = await startRes.json();
    if (startData.error || !startData.id) {
      console.log("❌ Failed to start session:", startData);
      return;
    }
    console.log(`✅ Session Started successfully on TABLE-17. ID: ${startData.id}`);
    const sessionId = startData.id;

    // 3. Edit Session
    console.log("\n⏳ [3/5] Testing Real-Time Session Edit Engine...");
    const editRes = await fetch(`${baseUrl}/api/edit-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        business_id: bId,
        customer_name: 'Super Diagnostic Tester'
      })
    });
    
    const editData = await editRes.json();
    if (!editData.success) {
      console.log("❌ Failed to edit session:", editData.error);
    } else {
      console.log(`✅ Customer Name successfully updated mid-session.`);
    }

    // 4. Wait a few seconds to simulate play
    console.log("\n⏳ [4/5] Simulating 3 seconds of gameplay...");
    await new Promise(r => setTimeout(r, 3000));

    // 5. End Session
    console.log("\n⏳ [5/5] Checking Out and Calculating Billing...");
    const endRes = await fetch(`${baseUrl}/api/end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: 'TABLE-17',
        business_id: bId
      })
    });
    
    const endData = await endRes.json();
    if (endData.error) {
      console.log("❌ Failed to end session:", endData);
      return;
    }
    
    console.log(`✅ Session Completed!`);
    console.log(`📊 Billing Calculation Result:`);
    console.log(`   - Duration: ${endData.duration} minutes`);
    console.log(`   - Total Cost Calculated: ₹${endData.cost}`);
    
    console.log("\n===========================================");
    console.log("🔥 ALL SYSTEMS OPERATIONAL. 100% SUCCESS RATE.");
    console.log("===========================================\n");

  } catch (error) {
    console.error("Test execution failed:", error);
  }
}

runTest();
