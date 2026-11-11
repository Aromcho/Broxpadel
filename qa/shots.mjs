// npm run qa → capturas mobile (iPhone 390x844 @2x) y desktop (1440x900) de todas las páginas y del panel, en qa/shots/.
// Con la tienda corriendo (npm run start). Opcional: node qa/shots.mjs http://mi-dominio mob|desk
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots'); mkdirSync(OUT, { recursive: true });
const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3000';
const MODE = process.argv.includes('mob') ? ['m'] : process.argv.includes('desk') ? ['d'] : ['m', 'd'];
const PUBLIC = [['catalogo', '/catalogo'], ['catalogo-shorts', '/catalogo?cat=shorts'], ['buscar', '/catalogo?q=violeta'], ['producto-remera', '/producto/remera-brox-violeta'], ['producto-short', '/producto/short-brox-celeste-degrade'], ['contacto', '/contacto'], ['envios', '/envios-y-pagos'], ['talles', '/talles'], ['arrepentimiento', '/arrepentimiento'], ['404', '/no-existe'], ['checkout-vacio', '/checkout']];
const ADMIN = ['', 'pedidos', 'productos', 'productos/1', 'medios', 'historias', 'banners', 'cupones', 'envios', 'negocio', 'categorias', 'colecciones', 'talles', 'usuarios'];
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

for (const m of MODE) {
  const b = await chromium.launch({ args: ARGS, executablePath: process.env.CHROME_PATH || undefined });
  const mobile = m === 'm';
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const snap = async (key, path) => {
    errs.length = 0;
    await p.goto(BASE + path, { waitUntil: 'load' });
    await p.waitForTimeout(2200);
    await p.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await p.waitForTimeout(1000);
    await p.screenshot({ path: join(OUT, `${m}-${key}.png`), fullPage: true });
    console.log(`${errs.length ? '✖' : '✔'} ${m}-${key}${errs.length ? ' ' + errs.join(' | ') : ''}`);
  };
  await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(5000);
  await p.screenshot({ path: join(OUT, `${m}-home-0.png`) });
  for (const sel of ['#catalogo', '#colecciones', '#en-la-cancha', 'footer']) {
    const el = p.locator(sel).first();
    if (!(await el.count())) continue;
    await el.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 60));
    await p.waitForTimeout(1800);
    await p.screenshot({ path: join(OUT, `${m}-home-${sel.replace('#', '')}.png`) });
  }
  for (const [k, path] of PUBLIC) await snap(k, path);
  await p.goto(BASE + '/admin/login', { waitUntil: 'load' });
  await p.locator('input[type=email]').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@broxpadel.com');
  await p.locator('input[type=password]').fill(process.env.SEED_ADMIN_PASSWORD ?? 'BroxPadel2026!');
  await p.locator('button[type=submit]').click();
  await p.waitForURL(/\/admin$/, { timeout: 20000 });
  for (const a of ADMIN) await snap('admin-' + (a.replace('/', '-') || 'dashboard'), '/admin/' + a);
  await b.close();
}
console.log(`Capturas en ${OUT}`);
