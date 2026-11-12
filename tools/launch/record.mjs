// Graba la tienda en un iPhone (390x797 @2x = pantalla debajo de la barra de estado), cuadro a cuadro a 24 fps:
// portada con el video de la cancha → catálogo → toque en la remera → ficha con el video de la prenda.
// Los videos se controlan por tiempo (se pausan y se llevan al segundo de cada cuadro), así cada cuadro es exacto.
// node tools/launch/record.mjs [url]  → /tmp/launch/rec/00000.png …
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3000';
const OUT = '/tmp/launch/rec';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const FPS = 24;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
const p = await ctx.newPage();
let n = 0;
const shot = async (t) => {
  await p.evaluate((tt) => window.__setTime?.(tt), t);
  await p.screenshot({ path: `${OUT}/${String(n++).padStart(5, '0')}.png` });
};
const scrollTo = (y) => p.evaluate((yy) => new Promise((r) => { window.scrollTo(0, yy); requestAnimationFrame(() => requestAnimationFrame(r)); }), y);
// lleva el video de fondo activo al segundo exacto del cuadro
const seekHero = (t) => p.evaluate(async (tt) => {
  const wrap = [...document.querySelectorAll('[data-court] > div')].find((d) => d.classList.contains('opacity-100') && d.querySelector('video'));
  const v = wrap?.querySelector('video');
  if (!v) return;
  v.pause();
  const target = Math.min(tt, (v.duration || 5) - 0.05);
  if (Math.abs(v.currentTime - target) < 0.002) return;
  await new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = target; setTimeout(r, 2000); });
}, t);

// ── 1) portada con el video de la cancha (1,9 s) y bajada al catálogo (1,4 s) ──
await p.goto(`${BASE}/?capture=1`, { waitUntil: 'load' });
await p.waitForFunction(() => { const v = document.querySelector('[data-court] video'); return v && v.readyState >= 2; }, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Pausar los videos' }).click();          // el recorrido maneja el video cuadro a cuadro
await p.addStyleTag({ content: '[data-court] button[aria-label$="videos"]{visibility:hidden}' });
const catTop = await p.evaluate(() => document.querySelector('#catalogo').getBoundingClientRect().top + scrollY);
const F1 = Math.round(1.9 * FPS), F2 = Math.round(1.4 * FPS), F3 = Math.round(0.9 * FPS);
let vt = 0.2;
for (let i = 0; i < F1; i++, vt += 1 / FPS) { await seekHero(vt); await shot(n / FPS); }
for (let i = 0; i < F2; i++, vt += 1 / FPS) { await seekHero(vt); await scrollTo(lerp(0, catTop + 330, ease(i / (F2 - 1)))); await shot(n / FPS); }
// toque en la remera violeta
const box = await p.locator('a[href="/producto/remera-brox-violeta"]').first().boundingBox();
await p.evaluate(({ x, y }) => {
  const d = document.createElement('div'); d.id = 'tap';
  Object.assign(d.style, { position: 'fixed', left: `${x - 26}px`, top: `${y - 26}px`, width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,.55)', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 4px 20px rgba(0,0,0,.35)', zIndex: 9999, opacity: 0, transform: 'scale(.6)', pointerEvents: 'none' });
  document.body.appendChild(d);
}, { x: box.x + box.width / 2, y: box.y + box.height * 0.42 });
for (let i = 0; i < F3; i++) {
  const k = i / (F3 - 1);
  await p.evaluate((kk) => { const d = document.getElementById('tap'); const a = kk < 0.35 ? kk / 0.35 : 1 - (kk - 0.35) / 0.65; d.style.opacity = String(Math.max(0, a)); d.style.transform = `scale(${0.6 + kk * 0.7})`; }, k);
  await shot(n / FPS);
}
console.log('portada y catálogo:', n, 'cuadros');

// ── 2) ficha del producto: su video en la cancha (1,5 s) y bajada a precio y talles (1,0 s) ──
await p.goto(`${BASE}/producto/remera-brox-violeta?capture=1`, { waitUntil: 'load' });
await p.waitForFunction(() => { const v = document.querySelector('main video'); return v && v.readyState >= 2; }, null, { timeout: 60000 });
await p.waitForTimeout(800);
const seekMain = (t) => p.evaluate(async (tt) => {
  const v = document.querySelector('main video');
  v.pause();
  const target = Math.min(tt, (v.duration || 5) - 0.05);
  if (Math.abs(v.currentTime - target) < 0.002) return;
  await new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = target; setTimeout(r, 2000); });
}, t);
const F4 = Math.round(1.5 * FPS), F5 = Math.round(1.0 * FPS);
const sizesY = await p.evaluate(() => { const el = [...document.querySelectorAll('legend')].find((l) => l.textContent.startsWith('Talle')); return el ? el.getBoundingClientRect().top + scrollY - 420 : 400; });
let pv = 0.6;
for (let i = 0; i < F4; i++, pv += 1 / FPS) { await seekMain(pv); await shot(n / FPS); }
for (let i = 0; i < F5; i++, pv += 1 / FPS) { await seekMain(pv); await scrollTo(lerp(0, sizesY, ease(i / (F5 - 1)))); await shot(n / FPS); }
console.log('total', n, 'cuadros');
await b.close();
