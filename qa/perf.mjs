// Rendimiento de la portada en un celular simulado: LCP y CLS con red 4G lenta + CPU x4.
// node qa/perf.mjs [url]   (con la tienda corriendo).
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.addInitScript(() => {
  window.__lcp = 0; window.__lcpEl = '';
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = (e.element?.tagName ?? '') + ' ' + (e.url || e.element?.className?.toString().slice(0, 40) || ''); } }).observe({ type: 'largest-contentful-paint', buffered: true });
  window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
});
const t0 = Date.now();
await p.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
const loadMs = Date.now() - t0;
await p.waitForTimeout(3000);
await p.mouse.click(5, 400); // la interacción cierra la medición de LCP
const lcp = await p.evaluate(() => ({ lcp: Math.round(window.__lcp), el: window.__lcpEl, cls: +window.__cls.toFixed(3) }));
const bytes = await p.evaluate(() => Math.round(performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) / 1024));
console.log(`LCP ${lcp.lcp} ms (${lcp.el}) · CLS ${lcp.cls} · load ${loadMs} ms · ${bytes} KB transferidos`);

await b.close();
