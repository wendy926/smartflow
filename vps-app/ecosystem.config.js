module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: './server.js',
    cwd: '/home/admin/smartflow-vps-app/vps-app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      TELEGRAM_BOT_TOKEN: '8023308948:AAEOK1pHRP5Mgd7oTRC7fheVTKUKwMnQjiA',
      TELEGRAM_CHAT_ID: '8307452638'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080,
      TELEGRAM_BOT_TOKEN: '8023308948:AAEOK1pHRP5Mgd7oTRC7fheVTKUKwMnQjiA',
      TELEGRAM_CHAT_ID: '8307452638'
    },
    log_file: '/root/.pm2/logs/smartflow-app.log',
    out_file: '/root/.pm2/logs/smartflow-app-out.log',
    error_file: '/root/.pm2/logs/smartflow-app-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log']
  }]
};