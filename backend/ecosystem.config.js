/**
 * PM2 process-manager config for Menos iT Consult.
 *
 *   cd backend
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *
 * In production Nginx (TLS) proxies -> 127.0.0.1:3000 (this single process).
 * public (/), admin (/admin) and API (/api/*) are all served by it.
 */
module.exports = {
  apps: [{
    name: 'menos-it',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    combine_logs: true,
    max_restarts: 5,
    kill_timeout: 5000,
  }],
};