/**
 * PM2 Process Supervisor Configuration
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart qcontrol-telegram-worker
 *   pm2 stop qcontrol-telegram-worker
 *   pm2 logs qcontrol-telegram-worker
 */

module.exports = {
  apps: [
    {
      name: 'qcontrol-telegram-worker',
      script: 'scripts/telegram-worker.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_restarts: 20,
      kill_timeout: 6000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
