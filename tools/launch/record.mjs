// Graba la tienda en un iPhone (390x797 @2x = pantalla debajo de la barra de estado), cuadro a cuadro a 24 fps
// con ?capture=1 y scroll suavizado determinístico: cancha → catálogo → toque en la remera → remera girando en 3D.
// node tools/launch/record.mjs [url]  → /tmp/launch/rec/00000.png …
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3000';
const OUT = '/tmp/launch/rec';
const PRODUCT_ONLY = process.argv.includes('--producto'); // regraba solo la parte de la ficha
if (!PRODUCT_ONLY) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const FPS = 24;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
const p = await ctx.newPage();
let n = 0;
const shot = async (t) => {
  await p.evaluate((tt) => window.__setTime(tt), t);
  await p.screenshot({ path: `${OUT}/${String(n++).padStart(5, '0')}.png` });
};
const scrollTo = (y) => p.evaluate((yy) => new Promise((r) => { window.scrollTo(0, yy); requestAnimationFrame(() => requestAnimationFrame(r)); }), y);

// ── 1) portada + cancha (3,4 s) y bajada al catálogo (1,2 s) ──
const F1 = Math.round(3.4 * FPS), F2 = Math.round(1.3 * FPS), F3 = Math.round(0.9 * FPS);
if (PRODUCT_ONLY) n = F1 + F2 + F3;
else {
await p.goto(`${BASE}/?capture=1`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__setTime && document.querySelector('[data-court] canvas'), null, { timeout: 90000 });
await p.waitForTimeout(6000);
const { courtEnd, catTop, card } = await p.evaluate(() => {
  const c = document.querySelector('[data-court]');
  const cat = document.querySelector('#catalogo');
  return { courtEnd: c.offsetTop + c.offsetHeight - innerHeight, catTop: cat.getBoundingClientRect().top + scrollY, card: null };
});
let t = 0;
for (let i = 0; i < F1; i++, t += 1 / FPS) {
  const k = i / (F1 - 1);
  const y = k < 0.12 ? 0 : lerp(0, courtEnd * 0.985, ease((k - 0.12) / 0.88));
  await scrollTo(y); await shot(t);
  if (i % 12 === 0) console.log('cancha', i, '/', F1);
}
const from = courtEnd * 0.985, to = catTop + 330; // grilla de productos a la vista
for (let i = 0; i < F2; i++, t += 1 / FPS) {
  await scrollTo(lerp(from, to, ease(i / (F2 - 1)))); await shot(t);
}
// toque en la remera violeta
const box = await p.locator('a[href="/producto/remera-brox-violeta"]').first().boundingBox();
await p.evaluate(({ x, y }) => {
  const d = document.createElement('div');
  d.id = 'tap';
  Object.assign(d.style, { position: 'fixed', left: `${x - 26}px`, top: `${y - 26}px`, width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,.55)', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 4px 20px rgba(0,0,0,.35)', zIndex: 9999, opacity: 0, transform: 'scale(.6)', pointerEvents: 'none' });
  document.body.appendChild(d);
}, { x: box.x + box.width / 2, y: box.y + box.height * 0.42 });
for (let i = 0; i < F3; i++, t += 1 / FPS) {
  const k = i / (F3 - 1);
  await p.evaluate((kk) => { const d = document.getElementById('tap'); const a = kk < 0.35 ? kk / 0.35 : 1 - (kk - 0.35) / 0.65; d.style.opacity = String(Math.max(0, a)); d.style.transform = `scale(${0.6 + kk * 0.7})`; }, k);
  await shot(t);
}
console.log('catálogo listo');
}

// ── 2) ficha del producto girando en 3D (2,4 s) ──
await p.goto(`${BASE}/producto/remera-brox-violeta?capture=1`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__setTime && document.querySelector('canvas'), null, { timeout: 90000 });
await p.waitForTimeout(5000);
const F4 = Math.round(2.4 * FPS);
for (let i = 0; i < F4; i++) {
  await scrollTo(0); await shot(-1.5 + (3.0 * i) / (F4 - 1)); // gira de -50° a +50°: pasa por el frente en el medio
}
console.log('frames', n);
await b.close();
