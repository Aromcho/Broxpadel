// PM2 en el VPS: pm2 start deploy/ecosystem.config.cjs && pm2 save
// Puertos propios para no chocar con los otros sitios del servidor (cambialos si ya están en uso: ss -ltnp).
const API_PORT = process.env.BROX_API_PORT || 4110;
const WEB_PORT = process.env.BROX_WEB_PORT || 3110;
const ROOT = __dirname + '/..';

module.exports = {
  apps: [
    {
      name: 'brox-api',
      cwd: `${ROOT}/apps/api`,
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', API_PORT, API_HOST: '127.0.0.1', WEB_INTERNAL_URL: `http://127.0.0.1:${WEB_PORT}` },
      max_memory_restart: '400M',
      time: true,
    },
    {
      name: 'brox-web',
      cwd: `${ROOT}/apps/web`,
      script: `${ROOT}/node_modules/next/dist/bin/next`,
      args: `start -p ${WEB_PORT} -H 127.0.0.1`,
      env: { NODE_ENV: 'production', API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}` },
      max_memory_restart: '500M',
      time: true,
    },
  ],
};
