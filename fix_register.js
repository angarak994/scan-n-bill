const fs = require('fs');

let code = fs.readFileSync('src/app/api/auth/register/route.ts', 'utf8');

const replacement = `    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Assign a 14-day free trial of the Growth plan by default
    const { data: growthPlan } = await supabase.from('subscription_plans').select('id').eq('name', 'Growth').single();
    if (growthPlan) {
       await supabase.from('business_subscriptions').insert([{
          business_id: data.id,
          plan_id: growthPlan.id,
          status: 'trialing',
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
       }]);
    }

    await setSession(data.id, 'owner');`;

code = code.replace(`    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    await setSession(data.id, 'owner');`, replacement);

fs.writeFileSync('src/app/api/auth/register/route.ts', code);
console.log("Updated register route to assign default trial.");
