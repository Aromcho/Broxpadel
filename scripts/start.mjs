// npm run start → corre la versión compilada (npm run build antes). En el VPS se usa PM2 (ver deploy/).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, serve, killOnExit, fail, log } from './lib.mjs';
if (!existsSync(join(ROOT, 'apps/api/dist/main.js')) || !existsSync(join(ROOT, 'apps/web/.next/BUILD_ID'))) fail('Primero compilá: npm run build');
log('web', 'Tienda: http://localhost:3000 · Panel: http://localhost:3000/admin');
const api = serve('api', 'npm', ['run', 'start', '-w', 'apps/api']);
const web = serve('web', 'npm', ['run', 'start', '-w', 'apps/web']);
killOnExit([api, web]);
