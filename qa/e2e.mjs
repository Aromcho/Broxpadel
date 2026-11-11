// Compra de punta a punta en un iPhone simulado + panel admin (Playwright).
// Lo arranca `npm run test:e2e` (levanta Mercado Pago simulado, la API apuntando a él y la web).
// Flujos: Mercado Pago (pago aprobado + webhook firmado), transferencia con descuento, pedido por WhatsApp,
// cupón, stock descontado, estados y seguimiento desde el panel, stock en 0 → la tienda lo refleja al instante.
import { chromium, expect } from 'playwright/test';
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT = join(HERE, 'shots'); mkdirSync(OUT, { recursive: true });
const SLUG = 'remera-brox-violeta';
const results = [];
const ok = (paso, cond, detalle = '') => { results.push({ paso, ok: !!cond, detalle }); console.log(`${cond ? '✔' : '✖'} ${paso} ${detalle}`); };
const product = async () => (await (await fetch(`${BASE}/api/store/products/${SLUG}`)).json()).product;
const variant = async (size) => (await product()).variants.find((v) => v.size === size);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
const p = await ctx.newPage();
const api = ctx.request;
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
const orderRow = async (number) => (await (await api.get(`${BASE}/api/admin/orders?q=${number}`)).json()).orders.find((o) => o.number === number);

async function addToCart(size, qty = 1) {
  await p.goto(`${BASE}/producto/${SLUG}`, { waitUntil: 'load' });
  await p.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^${size}$`) }).first().click();
  for (let i = 1; i < qty; i++) await p.getByRole('button', { name: /Sumar|Más|\+/ }).first().click();
  await p.getByRole('button', { name: 'Agregar al carrito' }).click();
  await p.waitForTimeout(600);
}
async function fillCheckout(method, coupon) {
  await p.goto(`${BASE}/checkout`, { waitUntil: 'load' });
  await p.getByLabel('Nombre y apellido').fill('Prueba QA');
  await p.getByLabel('Email (te mandamos la confirmación)').fill('qa@broxpadel.com');
  await p.getByLabel('WhatsApp / teléfono').fill('2255 409164');
  await p.getByLabel('Código postal').fill('7165');
  await p.waitForTimeout(900);
  const zone = p.locator('input[name=zone]').first();
  if (await zone.count()) await zone.check();
  if (await p.getByLabel('Calle y número').count()) {
    await p.getByLabel('Calle y número').fill('Av. 3 1234');
    await p.getByLabel('Ciudad / localidad').fill('Villa Gesell');
  }
  if (coupon) {
    await p.locator('#cupon').fill(coupon);
    await p.getByRole('button', { name: 'Aplicar' }).click();
    await p.waitForTimeout(1200);
  }
  const label = { mercadopago: 'Mercado Pago', transfer: 'Transferencia', whatsapp: 'Pedir por WhatsApp' }[method];
  await p.locator('label').filter({ has: p.locator('input[name=pay]') }).filter({ hasText: label }).first().click();
  await p.waitForTimeout(700);
}

try {
  // ── panel: login + cupón de prueba ──
  await p.goto(`${BASE}/admin/login`, { waitUntil: 'load' });
  await p.locator('input[type=email]').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@broxpadel.com');
  await p.locator('input[type=password]').fill(process.env.SEED_ADMIN_PASSWORD ?? 'BroxPadel2026!');
  await p.locator('button[type=submit]').click();
  await p.waitForURL(/\/admin$/, { timeout: 20000 });
  ok('Login del panel', true);
  for (const c of await (await api.get(`${BASE}/api/admin/coupons`)).json()) if (c.code === 'QA10') await api.delete(`${BASE}/api/admin/coupons/${c.id}`);
  const rc = await api.post(`${BASE}/api/admin/coupons`, { data: { code: 'QA10', type: 'percent', value: 10, active: true } });
  ok('Crear cupón QA10 (10%)', rc.ok(), rc.ok() ? '' : await rc.text());

  // ── 1. Mercado Pago ──
  const before = (await variant('M')).stock;
  await addToCart('M', 2);
  await fillCheckout('mercadopago', 'QA10');
  await p.screenshot({ path: join(OUT, 'e2e-1-checkout.png'), fullPage: true });
  ok('Cupón aplicado en el resumen', (await p.getByText(/Cupón QA10/).count()) > 0);
  await p.getByRole('button', { name: /Pagar con Mercado Pago/ }).click();
  await p.waitForURL(/127\.0\.0\.1:4600/, { timeout: 20000 });
  ok('Redirige a Mercado Pago con la preferencia', true, await p.locator('#total').innerText());
  await p.screenshot({ path: join(OUT, 'e2e-2-mp.png') });
  await p.locator('#pay').click();
  await p.waitForURL(/\/pedido\/BX-/, { timeout: 20000 });
  const number = p.url().match(/\/pedido\/(BX-\d+)/)[1];
  await expect(p.getByText('Pagado').first()).toBeVisible({ timeout: 15000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(OUT, 'e2e-3-pagado.png'), fullPage: true });
  let row = await orderRow(number);
  ok('Pedido MP pagado (webhook firmado + vuelta del checkout)', row.status === 'paid', `${number} ${row.status} $${row.total}`);
  const after = (await variant('M')).stock;
  ok('Stock descontado (2 unidades talle M)', after === before - 2, `${before} → ${after}`);
  const outbox = join(HERE, '../apps/api/storage/mail-outbox');
  const mails = existsSync(outbox) ? readdirSync(outbox).filter((f) => f.includes(number)) : [];
  ok('Mails del pedido (creado + pagado)', mails.length >= 1, mails.join(', '));

  // ── 2. Transferencia ──
  await addToCart('L');
  await fillCheckout('transfer');
  await p.getByRole('button', { name: /Confirmar pedido|Confirmar/ }).last().click();
  await p.waitForURL(/\/pedido\/BX-/, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(OUT, 'e2e-4-transferencia.png'), fullPage: true });
  const n2 = p.url().match(/\/pedido\/(BX-\d+)/)[1];
  const r2 = await orderRow(n2);
  ok('Pedido por transferencia con descuento', r2.transferDiscount > 0 && r2.status === 'pending_payment', `${n2} desc $${r2.transferDiscount} total $${r2.total}`);

  // ── 3. WhatsApp ──
  await addToCart('S');
  await fillCheckout('whatsapp');
  await ctx.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, (r) => r.fulfill({ body: 'WhatsApp', contentType: 'text/plain' }));
  const [wa] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: /WhatsApp/ }).last().click()]);
  await wa.waitForLoadState();
  const waText = decodeURIComponent(wa.url());
  await wa.close();
  await p.waitForURL(/\/pedido\/BX-/, { timeout: 20000 });
  ok('Pedido por WhatsApp abre el chat con el mensaje armado', /wa\.me|whatsapp/.test(waText) && waText.includes('Remera Brox violeta'), waText.slice(0, 120).replace(/\n/g, ' '));
  await p.screenshot({ path: join(OUT, 'e2e-5-whatsapp.png'), fullPage: true });

  // ── 4. Panel: estados y seguimiento ──
  await p.goto(`${BASE}/admin/pedidos`, { waitUntil: 'load' });
  await p.getByText(number).first().click();
  await p.waitForURL(/\/admin\/pedidos\/\d+/);
  await p.getByRole('button', { name: 'Preparando' }).click();
  await p.waitForTimeout(800);
  await p.getByLabel('Código de seguimiento').fill('CA123456789AR');
  await p.getByRole('button', { name: /Guardar y marcar enviado/ }).click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: join(OUT, 'e2e-6-admin-pedido.png'), fullPage: true });
  row = await orderRow(number);
  ok('Panel: preparando → enviado con seguimiento', row.status === 'shipped' && row.trackingCode === 'CA123456789AR', row.status);

  // stock en 0 desde el panel → la tienda lo muestra sin reiniciar nada
  const prod = await product();
  const xl = prod.variants.find((v) => v.size === 'XL');
  const rq = await api.patch(`${BASE}/api/admin/products/${prod.id}/quick`, { data: { variant: { id: xl.id, stock: 0 } } });
  ok('Panel: stock XL en 0', rq.ok());
  await p.waitForTimeout(800);
  await p.goto(`${BASE}/producto/${SLUG}`, { waitUntil: 'load' });
  ok('Tienda: XL agotado al instante (revalidación por tags)', await p.locator('button[aria-pressed]').filter({ hasText: /^XL$/ }).first().isDisabled());
  await api.patch(`${BASE}/api/admin/products/${prod.id}/quick`, { data: { variant: { id: xl.id, stock: xl.stock } } });

  // cancelar devuelve el stock
  const beforeL = (await variant('L')).stock;
  await api.patch(`${BASE}/api/admin/orders/${r2.id}`, { data: { status: 'cancelled' } });
  const afterL = (await variant('L')).stock;
  ok('Cancelar un pedido devuelve el stock', afterL === beforeL + 1, `${beforeL} → ${afterL}`);
  await api.delete(`${BASE}/api/admin/coupons/${(await (await api.get(`${BASE}/api/admin/coupons`)).json()).find((c) => c.code === 'QA10').id}`);
  ok('Sin errores de JavaScript', !errors.length, errors.slice(0, 3).join('; '));
} catch (e) {
  ok('Flujo completo', false, String(e).slice(0, 300));
  await p.screenshot({ path: join(OUT, 'e2e-error.png'), fullPage: true }).catch(() => {});
}
await browser.close();
writeFileSync(join(OUT, 'e2e-resultado.json'), JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} pasos OK`);
process.exit(bad.length ? 1 : 0);
