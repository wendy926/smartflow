module.exports = {
  apps: [{
    name: 'backtest-refactored',
    script: 'src/main-refactored.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/refactored-error.log',
    out_file: './logs/refactored-out.log',
    log_file: './logs/refactored-combined.log',
    time: true
  }]
};
