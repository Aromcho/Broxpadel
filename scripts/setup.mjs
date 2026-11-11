// npm run setup → crea los .env, levanta PostgreSQL (Docker), compila la API, migra y carga el catálogo.
// Opciones: --no-docker (usás tu propio PostgreSQL; poné su URL en apps/api/.env) · --force (recarga el catálogo aunque ya exista)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { ROOT, run, ok, fail, log, readEnv, portOpen, sleep } from './lib.mjs';

const args = process.argv.slice(2);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 9)) fail(`Necesitás Node 20.9 o más nuevo (tenés ${process.versions.node}). Bajalo de https://nodejs.org`);

// 1) archivos .env (secretos generados al azar, los mismos en API y web)
const apiEnv = join(ROOT, 'apps/api/.env');
const webEnv = join(ROOT, 'apps/web/.env.local');
const secret = () => randomBytes(24).toString('base64url');
if (!existsSync(apiEnv)) {
  const s = readFileSync(join(ROOT, 'apps/api/.env.example'), 'utf8')
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
    .replace(/^REVALIDATE_SECRET=.*$/m, `REVALIDATE_SECRET=${secret()}`);
  writeFileSync(apiEnv, s);
  ok('apps/api/.env creado');
}
const api = readEnv(apiEnv);
if (!existsSync(webEnv)) {
  const s = readFileSync(join(ROOT, 'apps/web/.env.example'), 'utf8').replace(/^REVALIDATE_SECRET=.*$/m, `REVALIDATE_SECRET=${api.REVALIDATE_SECRET}`);
  writeFileSync(webEnv, s);
  ok('apps/web/.env.local creado');
}

// 2) dependencias
if (!existsSync(join(ROOT, 'node_modules'))) {
  log('db', 'Instalando dependencias (npm install)…');
  await run('npm', ['install']);
}

// 3) base de datos
const url = new URL(api.DATABASE_URL ?? 'postgres://brox:brox@localhost:5433/broxpadel');
const host = url.hostname, port = Number(url.port || 5432);
if (!(await portOpen(host, port))) {
  if (args.includes('--no-docker')) fail(`No hay PostgreSQL en ${host}:${port}. Arrancalo o corregí DATABASE_URL en apps/api/.env`);
  log('db', 'Levantando PostgreSQL con Docker (docker compose up -d db)…');
  try { await run('docker', ['compose', 'up', '-d', 'db']); }
  catch { fail('No pude usar Docker. Abrí Docker Desktop y volvé a correr "npm run setup", o usá tu PostgreSQL con "npm run setup -- --no-docker".'); }
}
for (let i = 0; i < 60 && !(await portOpen(host, port)); i++) await sleep(1000);
// el puerto abre un poco antes de que acepte conexiones
const { default: pg } = await import('pg');
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  const c = new pg.Client({ connectionString: url.toString() });
  try { await c.connect(); await c.query('select 1'); ready = true; } catch { await sleep(1000); } finally { await c.end().catch(() => {}); }
}
if (!ready) fail(`PostgreSQL no responde en ${host}:${port}`);
ok(`PostgreSQL listo en ${host}:${port}`);

// 4) API compilada → migraciones → catálogo
await run('npm', ['run', 'build', '-w', 'apps/api']);
await run('npm', ['run', 'db:migrate', '-w', 'apps/api']);
await run('npm', ['run', 'db:seed', '-w', 'apps/api', '--', ...(args.includes('--force') ? ['--force'] : [])]);

console.log(`
${'\x1b[32m'}Todo listo.${'\x1b[0m'}
  npm run dev      → tienda en http://localhost:3000 y panel en http://localhost:3000/admin
  npm run build    → compila para producción
  npm run start    → corre la versión compilada
`);
