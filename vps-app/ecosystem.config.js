module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: 'server.js',
    cwd: '/home/admin/smartflow-vps-app/vps-app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''
    },
    log_file: '/root/.pm2/logs/smartflow-app.log',
    out_file: '/root/.pm2/logs/smartflow-app-out.log',
    error_file: '/root/.pm2/logs/smartflow-app-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};