// Recorrido en video de la tienda en un iPhone (390x844 @2x), cuadro a cuadro a 24 fps con ?capture=1:
// cancha 3D → catálogo → remera en 3D → talle → carrito → checkout (transferencia) → pedido → panel admin.
// node tools/launch/walkthrough.mjs [url] → /tmp/walk/%05d.png  (después: ffmpeg → reel/recorrido-tienda.mp4)
// Ojo: crea un pedido de prueba real en la base (transferencia).
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3000';
const OUT = '/tmp/walk';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const FPS = 24;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
const p = await ctx.newPage();
let n = 0, t = 0, last = null;
const file = () => `${OUT}/${String(n).padStart(5, '0')}.png`;
const shot = async () => {
  const has = await p.evaluate(() => !!window.__setTime);
  if (has) await p.evaluate((tt) => window.__setTime(tt), t);
  last = file(); await p.screenshot({ path: last }); n++; t += 1 / FPS;
};
const hold = async (sec, live = false) => {          // pantalla quieta: un cuadro y copias (o cuadros reales si hay 3D)
  const k = Math.round(sec * FPS);
  if (live) { for (let i = 0; i < k; i++) await shot(); return; }
  await shot();
  for (let i = 1; i < k; i++) { copyFileSync(last, file()); n++; t += 1 / FPS; }
};
const scrollTo = (y) => p.evaluate((yy) => new Promise((r) => { window.scrollTo(0, yy); requestAnimationFrame(() => requestAnimationFrame(r)); }), y);
const glide = async (from, to, sec) => { const k = Math.round(sec * FPS); for (let i = 0; i < k; i++) { await scrollTo(lerp(from, to, ease(i / (k - 1)))); await shot(); } };
const tap = async (locator, sec = 0.5) => {          // círculo de toque sobre el elemento antes de tocarlo
  const box = await locator.boundingBox();
  await p.evaluate(({ x, y }) => { const d = document.createElement('div'); d.id = '__tap'; Object.assign(d.style, { position: 'fixed', left: `${x - 24}px`, top: `${y - 24}px`, width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,.5)', border: '2px solid rgba(255,255,255,.95)', boxShadow: '0 3px 16px rgba(0,0,0,.35)', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(d); }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const k = Math.round(sec * FPS);
  for (let i = 0; i < k; i++) { await p.evaluate((kk) => { const d = document.getElementById('__tap'); d.style.opacity = String(kk < 0.4 ? kk / 0.4 : 1 - (kk - 0.4) / 0.6); d.style.transform = `scale(${0.7 + kk * 0.6})`; }, i / (k - 1)); await shot(); }
  await p.evaluate(() => document.getElementById('__tap')?.remove());
  await locator.click();
};
const log = (m) => console.log(`${m} · cuadro ${n} (${(n / FPS).toFixed(1)} s)`);

// ── 1. portada y cancha ──
await p.goto(`${BASE}/?capture=1`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__setTime && document.querySelector('[data-court] canvas'), null, { timeout: 90000 });
await p.waitForTimeout(6000);
const { courtEnd, catTop } = await p.evaluate(() => { const c = document.querySelector('[data-court]'); return { courtEnd: c.offsetTop + c.offsetHeight - innerHeight, catTop: document.querySelector('#catalogo').getBoundingClientRect().top + scrollY }; });
await hold(1.2, true);
// se frena en cada momento del punto para que se lean los textos
const keys = [[0, 0], [1.4, 0.16], [2.4, 0.16], [3.6, 0.345], [4.6, 0.345], [5.8, 0.53], [6.8, 0.53], [8.0, 0.72], [9.0, 0.72], [10.3, 0.95], [11.4, 0.95]];
for (let i = 1; i < keys.length; i++) {
  const [t0, p0] = keys[i - 1], [t1, p1] = keys[i];
  const k = Math.round((t1 - t0) * FPS);
  for (let j = 0; j < k; j++) { await scrollTo(courtEnd * lerp(p0, p1, ease(j / k))); await shot(); }
}
log('cancha');
await glide(courtEnd * 0.95, catTop - 10, 1.4);
await hold(0.8);
await glide(catTop - 10, catTop + 520, 1.6);
await hold(0.5);
await tap(p.locator('a[href="/producto/remera-brox-violeta"]').first(), 0.6);
log('catálogo');

// ── 2. ficha de la remera ──
await p.waitForURL(/remera-brox-violeta/);
await p.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 60000 });
await p.waitForTimeout(5000);
await scrollTo(0);
await hold(3.2, true);                              // gira en 3D
await tap(p.locator('button[aria-pressed]').filter({ hasText: /^M$/ }).first(), 0.5);
const y0 = await p.evaluate(() => scrollY);
await glide(y0, 520, 1.2);
await hold(0.6, true);
await tap(p.getByRole('button', { name: 'Agregar al carrito' }), 0.5);
await p.waitForTimeout(700);
await hold(1.6);
log('producto');

// ── 3. checkout por transferencia ──
await tap(p.getByRole('link', { name: 'Finalizar compra' }), 0.5);
await p.waitForURL(/checkout/); await p.waitForTimeout(1500);
await hold(0.8);
await p.getByLabel('Nombre y apellido').fill('Cliente de prueba');
await p.getByLabel('Email (te mandamos la confirmación)').fill('prueba@broxpadel.com');
await p.getByLabel('WhatsApp / teléfono').fill('2255 123456');
await p.getByLabel('Código postal').fill('7165');
await p.waitForTimeout(1000);
const zone = p.locator('input[name=zone]').first(); if (await zone.count()) await zone.check();
await p.getByLabel('Calle y número').fill('Av. 3 1234');
await p.getByLabel('Ciudad / localidad').fill('Villa Gesell');
await p.locator('label').filter({ has: p.locator('input[name=pay]') }).filter({ hasText: 'Transferencia' }).first().click();
await p.waitForTimeout(1200);
await hold(0.8);
const H = await p.evaluate(() => document.body.scrollHeight - innerHeight);
const sumY = await p.evaluate(() => { const el = [...document.querySelectorAll('button[type=submit]')].pop(); return el.getBoundingClientRect().top + scrollY - innerHeight + 140; });
await glide(0, Math.min(H, sumY), 3.0);
await hold(0.8);
await tap(p.getByRole('button', { name: /Confirmar pedido/ }), 0.5);
await p.waitForURL(/\/pedido\//); await p.waitForTimeout(2000);
await hold(1.8);
log('checkout');

// ── 4. panel ──
await p.goto(`${BASE}/admin/login`, { waitUntil: 'load' }); await p.waitForTimeout(800);
await hold(0.8);
await p.locator('input[type=email]').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@broxpadel.com');
await p.locator('input[type=password]').fill(process.env.SEED_ADMIN_PASSWORD ?? 'BroxPadel2026!');
await hold(0.5);
await p.locator('button[type=submit]').click();
await p.waitForURL(/\/admin$/); await p.waitForTimeout(2200);
await hold(1.6);
await glide(0, 700, 1.4);
await hold(0.6);
await p.goto(`${BASE}/admin/pedidos`, { waitUntil: 'load' }); await p.waitForTimeout(1800);
await hold(1.0);
await tap(p.locator('a[href^="/admin/pedidos/"]').first(), 0.5);
await p.waitForURL(/\/admin\/pedidos\/\d+/); await p.waitForTimeout(1800);
await hold(1.0);
await tap(p.getByRole('button', { name: 'Pagado' }), 0.5);
await p.waitForTimeout(1200);
await hold(1.4);
await p.goto(`${BASE}/admin/productos`, { waitUntil: 'load' }); await p.waitForTimeout(2000);
await hold(1.0);
await glide(0, 600, 1.2);
await hold(0.8);
log('panel');
await b.close();
