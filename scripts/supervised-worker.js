/**
 * QControl Telegram Bot - Standalone Process Supervisor
 * 
 * Provides resilient, zero-dependency process supervision:
 * 1. Spawns telegram-worker as a supervised child process.
 * 2. Automatically restarts the worker upon unexpected exit or crash.
 * 3. Exponential backoff restart delay (protects against rapid crash loops).
 * 4. Graceful signal forwarding (SIGINT, SIGTERM) to allow clean webhook handoff.
 * 5. Structured crash logging and uptime tracking.
 */

const { spawn } = require('child_process');
const path = require('path');

let childProcess = null;
let restartCount = 0;
let consecutiveRapidCrashes = 0;
let isShuttingDown = false;
let lastStartTime = Date.now();

const MAX_RAPID_CRASHES = 10;
const RAPID_CRASH_THRESHOLD_MS = 10000; // If process dies within 10s of start

function startChild() {
  if (isShuttingDown) return;

  lastStartTime = Date.now();
  restartCount++;
  console.log(`\n[Supervisor] Starting worker process (Invocation #${restartCount})...`);

  // Spawn tsx running telegram-worker.ts
  const workerScript = path.join(__dirname, 'telegram-worker.ts');
  childProcess = spawn('npx', ['tsx', workerScript], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  childProcess.on('exit', (code, signal) => {
    const uptimeMs = Date.now() - lastStartTime;
    childProcess = null;

    if (isShuttingDown) {
      console.log(`[Supervisor] Worker exited cleanly following shutdown signal.`);
      process.exit(code || 0);
    }

    console.warn(`[Supervisor] ⚠️ Worker process exited with code=${code}, signal=${signal} (ran for ${(uptimeMs / 1000).toFixed(1)}s).`);

    if (uptimeMs < RAPID_CRASH_THRESHOLD_MS) {
      consecutiveRapidCrashes++;
      console.warn(`[Supervisor] Rapid crash detected (${consecutiveRapidCrashes}/${MAX_RAPID_CRASHES}).`);
    } else {
      consecutiveRapidCrashes = 0;
    }

    if (consecutiveRapidCrashes >= MAX_RAPID_CRASHES) {
      console.error(`[Supervisor] ❌ Too many consecutive rapid crashes (${consecutiveRapidCrashes}). Pausing 30 seconds before retry...`);
      setTimeout(() => {
        consecutiveRapidCrashes = 0;
        startChild();
      }, 30000);
      return;
    }

    // Exponential backoff restart delay between 1s and 10s
    const restartDelayMs = Math.min(1000 * Math.pow(1.5, consecutiveRapidCrashes), 10000);
    console.log(`[Supervisor] Automatically restarting worker in ${restartDelayMs}ms...`);
    setTimeout(startChild, restartDelayMs);
  });

  childProcess.on('error', (err) => {
    console.error('[Supervisor] Failed to spawn child process:', err.message);
  });
}

function handleSignal(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Supervisor] Received ${signal}. Forwarding to worker child process...`);

  if (childProcess) {
    childProcess.kill(signal);
    // Safety fallback: force kill if child fails to exit in 8 seconds
    setTimeout(() => {
      if (childProcess) {
        console.warn('[Supervisor] Worker did not exit within timeout. Sending SIGKILL...');
        childProcess.kill('SIGKILL');
        process.exit(1);
      }
    }, 8000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

console.log('='.repeat(65));
console.log('🛡️ QControl Telegram Supervisor Initialized');
console.log('='.repeat(65));

startChild();
