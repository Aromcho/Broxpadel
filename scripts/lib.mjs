// Utilidades compartidas por los scripts (andan igual en Windows, macOS y Linux).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const isWin = process.platform === 'win32';

const colors = { api: '\x1b[36m', web: '\x1b[35m', db: '\x1b[33m', ok: '\x1b[32m', err: '\x1b[31m', dim: '\x1b[2m', end: '\x1b[0m' };
export const log = (tag, msg) => console.log(`${colors[tag] ?? ''}${tag.padEnd(4)}${colors.end} ${msg}`);
export const ok = (msg) => console.log(`${colors.ok}✔${colors.end} ${msg}`);
export const fail = (msg) => { console.error(`${colors.err}✖ ${msg}${colors.end}`); process.exit(1); };

/** Corre un comando y espera; muestra la salida. */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: isWin, ...opts });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} terminó con código ${code}`))));
  });
}

/** Corre un comando de larga vida con prefijo de color en cada línea. */
export function serve(tag, cmd, args, opts = {}) {
  const p = spawn(cmd, args, { cwd: ROOT, shell: isWin, env: process.env, ...opts });
  const pipe = (s) => s.on('data', (d) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => log(tag, l)));
  pipe(p.stdout); pipe(p.stderr);
  return p;
}

/** Lee un .env simple (KEY=valor). */
export function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}

/** ¿Hay algo escuchando en host:port? */
export function portOpen(host, port, timeout = 800) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout }, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mata ambos procesos al cortar con Ctrl+C. */
export function killOnExit(procs) {
  const stop = () => {
    for (const p of procs) {
      if (p.exitCode !== null) continue;
      if (isWin) spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' });
      else p.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  procs.forEach((p) => p.on('exit', (code) => { if (code && code !== 0) { log('err', `un proceso terminó con código ${code}`); stop(); } }));
}
