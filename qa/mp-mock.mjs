// Servidor que imita la API de Mercado Pago (Checkout Pro) para probar el flujo completo sin salir a internet:
// crea preferencias, muestra una pantalla de pago, manda el webhook firmado (x-signature) y vuelve a la tienda.
// La API se apunta acá con MP_API_BASE=http://127.0.0.1:4600 (solo para pruebas).
import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

const PORT = Number(process.env.MP_MOCK_PORT ?? 4600);
const SECRET = process.env.MP_WEBHOOK_SECRET ?? 'mock-webhook-secret';
const prefs = new Map();
const payments = new Map();
let nextPayment = 90000001;

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const read = (req) => new Promise((r) => { let s = ''; req.on('data', (d) => (s += d)); req.on('end', () => r(s ? JSON.parse(s) : {})); });

async function notify(pref, payment) {
  if (!pref.notification_url) return;
  const ts = Math.floor(Date.now() / 1000);
  const reqId = randomUUID();
  const id = String(payment.id);
  const v1 = createHmac('sha256', SECRET).update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');
  const url = `${pref.notification_url}${pref.notification_url.includes('?') ? '&' : '?'}data.id=${id}&type=payment`;
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId }, body: JSON.stringify({ action: 'payment.created', type: 'payment', data: { id } }) });
  console.log(`webhook → ${r.status} ${await r.text()}`);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
    if (!/^Bearer TEST-/.test(req.headers.authorization ?? '')) return json(res, 401, { message: 'invalid token' });
    const body = await read(req);
    const id = `mock-${randomUUID().slice(0, 8)}`;
    prefs.set(id, body);
    const link = `http://127.0.0.1:${PORT}/checkout/v1/redirect?pref_id=${id}`;
    console.log(`preferencia ${id} · ${body.external_reference} · ${body.items.length} ítems`);
    return json(res, 201, { id, init_point: link, sandbox_init_point: link });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/v1/payments/')) {
    const p = payments.get(url.pathname.split('/').pop());
    return p ? json(res, 200, p) : json(res, 404, { message: 'not found' });
  }
  if (url.pathname === '/checkout/v1/redirect') {
    const pref = prefs.get(url.searchParams.get('pref_id'));
    if (!pref) return json(res, 404, { message: 'pref not found' });
    const total = pref.items.reduce((a, i) => a + i.unit_price * i.quantity, 0) + (pref.shipments?.cost ?? 0);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Mercado Pago (simulado)</title>
      <body style="font-family:system-ui;background:#eee;margin:0;padding:24px"><div style="max-width:420px;margin:auto;background:#fff;border-radius:12px;padding:24px">
      <p style="color:#009ee3;font-weight:700">Mercado Pago · sandbox simulado</p><h1 id=total>$ ${total.toLocaleString('es-AR')}</h1>
      <ul>${pref.items.map((i) => `<li>${i.quantity} × ${i.title} — $${i.unit_price}</li>`).join('')}</ul>
      <a id=pay href="/pay?pref_id=${url.searchParams.get('pref_id')}&r=approved" style="display:block;background:#009ee3;color:#fff;padding:14px;text-align:center;border-radius:8px;text-decoration:none">Pagar</a>
      <a id=reject href="/pay?pref_id=${url.searchParams.get('pref_id')}&r=rejected" style="display:block;margin-top:8px;text-align:center">Rechazar tarjeta</a></div>`);
  }
  if (url.pathname === '/pay') {
    const prefId = url.searchParams.get('pref_id');
    const pref = prefs.get(prefId);
    const approved = url.searchParams.get('r') === 'approved';
    const total = pref.items.reduce((a, i) => a + i.unit_price * i.quantity, 0) + (pref.shipments?.cost ?? 0);
    const payment = { id: nextPayment++, status: approved ? 'approved' : 'rejected', status_detail: approved ? 'accredited' : 'cc_rejected_other_reason', external_reference: pref.external_reference, transaction_amount: Math.round(total * 100) / 100 };
    payments.set(String(payment.id), payment);
    console.log(`pago ${payment.id} ${payment.status} $${payment.transaction_amount}`);
    await notify(pref, payment).catch((e) => console.log('webhook falló', e.message));
    const back = new URL(approved ? pref.back_urls.success : pref.back_urls.failure);
    back.searchParams.set('collection_id', String(payment.id)); back.searchParams.set('payment_id', String(payment.id));
    back.searchParams.set('status', payment.status); back.searchParams.set('external_reference', pref.external_reference); back.searchParams.set('preference_id', prefId);
    res.writeHead(302, { location: back.toString() }); return res.end();
  }
  json(res, 404, { message: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`MP simulado en http://127.0.0.1:${PORT}`));
