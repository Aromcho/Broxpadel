// npm run test:e2e → prueba la compra de punta a punta sin tocar Mercado Pago real:
// levanta MP simulado (:4600), la API apuntando a él (:4000) y la web compilada (:3000), corre qa/e2e.mjs y apaga todo.
// Requisitos: npm run setup + npm run build, y una vez: npx playwright install chromium
// Ojo: crea pedidos de prueba en la base. Para volver al catálogo limpio: npm run db:seed -- --force
import { join } from 'node:path';
import { ROOT, serve, run, portOpen, sleep, fail, ok, isWin } from './lib.mjs';
import { spawn } from 'node:child_process';

for (const port of [3000, 4000, 4600]) if (await portOpen('127.0.0.1', port)) fail(`El puerto ${port} está ocupado: cortá "npm run dev"/"npm run start" antes de correr las pruebas.`);
const secret = 'e2e-webhook-secret';
const env = { ...process.env, MP_API_BASE: 'http://127.0.0.1:4600', MP_ACCESS_TOKEN: 'TEST-e2e-token', MP_PUBLIC_KEY: 'TEST-e2e', MP_WEBHOOK_SECRET: secret, MP_NOTIFICATION_URL: 'http://127.0.0.1:4000/api/payments/mp/webhook' };
const procs = [
  serve('mp', 'node', [join(ROOT, 'qa/mp-mock.mjs')], { env: { ...process.env, MP_WEBHOOK_SECRET: secret } }),
  serve('api', 'npm', ['run', 'start', '-w', 'apps/api'], { env }),
  serve('web', 'npm', ['run', 'start', '-w', 'apps/web']),
];
const stop = () => procs.forEach((p) => (isWin ? spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' }) : p.kill('SIGTERM')));
process.on('SIGINT', () => { stop(); process.exit(1); });
for (let i = 0; i < 90; i++) { if ((await portOpen('127.0.0.1', 3000)) && (await portOpen('127.0.0.1', 4000)) && (await portOpen('127.0.0.1', 4600))) break; await sleep(1000); }
await sleep(4000); // la API refresca la caché de la tienda al arrancar (Mercado Pago activo)
ok('Servidores de prueba listos');
let code = 0;
try { await run('node', [join(ROOT, 'qa/e2e.mjs')]); } catch { code = 1; }
stop();
setTimeout(() => process.exit(code), 500);
