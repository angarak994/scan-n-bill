/**
 * QControl - Master Local Test Runner
 * 
 * Runs a complete, automated end-to-end verification of the local environment:
 * 1. Dev Server & Health API Check (http://localhost:3000/api/health)
 * 2. TypeScript compilation integrity (tsc --noEmit)
 * 3. ESLint health on core dashboard components
 * 4. Central WhatsApp Routing & Multi-Tenant Isolation
 * 5. Full 14-Point QControl Intelligence & Atomic Concurrency Suite
 * 6. Live Local WhatsApp Conversational Simulation
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { execSync } from 'child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function logSection(title: string) {
  console.log(`\n${CYAN}${BOLD}====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}${title}${RESET}`);
  console.log(`${CYAN}${BOLD}====================================================${RESET}`);
}

function runStep(name: string, command: string) {
  process.stdout.write(`⏳ ${name}... `);
  try {
    const start = Date.now();
    execSync(command, { stdio: 'pipe' });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`${GREEN}PASSED${RESET} (${elapsed}s)`);
    return true;
  } catch (err: any) {
    console.log(`${RED}FAILED${RESET}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    return false;
  }
}

async function checkDevServer() {
  process.stdout.write(`⏳ 1. Checking Next.js dev server (http://localhost:3000)... `);
  try {
    const res = await fetch('http://localhost:3000/api/health');
    if (!res.ok) {
      console.log(`${RED}FAILED (HTTP ${res.status})${RESET}`);
      return false;
    }
    const json = await res.json();
    console.log(`${GREEN}HEALTHY${RESET} (DB: ${json.checks?.database?.status}, Latency: ${json.checks?.database?.latencyMs}ms)`);
    return true;
  } catch (err: any) {
    console.log(`${RED}FAILED (Server not reachable on port 3000)${RESET}`);
    console.log(`   👉 Run: npm run dev to start the local Next.js dev server.`);
    return false;
  }
}

async function main() {
  console.log(`\n${BOLD}🚀 QCONTROL MASTER LOCAL PRE-FLIGHT VERIFICATION${RESET}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target: http://localhost:3000\n`);

  const results: { name: string; passed: boolean }[] = [];

  // Step 1: Dev Server Health
  results.push({ name: 'Next.js Dev Server Health', passed: await checkDevServer() });

  // Step 2: TypeScript Compilation
  results.push({
    name: 'TypeScript Compilation (tsc --noEmit)',
    passed: runStep('2. Checking TypeScript types across codebase', 'npx tsc --noEmit')
  });

  // Step 3: ESLint Checks
  results.push({
    name: 'ESLint Dashboard Code Health',
    passed: runStep('3. Checking ESLint rules on BookingsTab', 'npx eslint src/app/dashboard/BookingsTab.tsx')
  });

  // Step 4: Central WhatsApp Routing & Isolation
  results.push({
    name: 'Central WhatsApp Routing & Multi-Tenant Isolation',
    passed: runStep('4. Running Central WhatsApp Routing suite', 'npx tsx scripts/test-central-whatsapp-routing.ts')
  });

  // Step 5: Full QControl Intelligence & Concurrency Suite (14 Tests)
  results.push({
    name: 'QControl Intelligence & Concurrency Suite (14 Tests)',
    passed: runStep('5. Running 14-Point Intelligence & Booking Concurrency suite', 'npx tsx scripts/test-qcontrol-intelligence-suite.ts')
  });

  // Step 6: Local WhatsApp Simulator Test
  results.push({
    name: 'Local WhatsApp Conversational Simulation',
    passed: runStep('6. Simulating local WhatsApp booking dialog', 'npx tsx scripts/simulate-whatsapp.ts "QC_levelup"')
  });

  // Summary Table
  logSection('📊 LOCAL VERIFICATION SUMMARY');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? `${GREEN}✅ PASS${RESET}` : `${RED}❌ FAIL${RESET}`;
    console.log(` ${icon}  ${r.name}`);
    if (!r.passed) allPassed = false;
  }

  console.log('\n----------------------------------------------------');
  if (allPassed) {
    console.log(`${GREEN}${BOLD}🎉 ALL LOCAL CHECKS & TEST SUITES PASSED!${RESET}`);
    console.log(`Your local environment is 100% prepared for testing:\n`);
    console.log(`1. 🖥️  Web Dashboard:   http://localhost:3000/dashboard#bookings`);
    console.log(`2. 💬  WhatsApp Bot:    npx tsx scripts/simulate-whatsapp.ts`);
    console.log(`3. 🤖  Telegram Worker: npm run worker`);
    console.log(`4. 📱  Customer QR:     http://localhost:3000/qr/levelup/P1\n`);
  } else {
    console.log(`${RED}${BOLD}⚠️ SOME CHECKS FAILED. Please review the output above.${RESET}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
