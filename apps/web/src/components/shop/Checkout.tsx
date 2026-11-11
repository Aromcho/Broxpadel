/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useCart } from '@/lib/cart';
import { useHydrated } from '@/lib/hooks';
import { money } from '@/lib/format';

const PROVINCES = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];

type Quote = {
  lines: { variantId: number; name: string; size: string; unitPrice: number; qty: number; total: number; stock: number; image: string | null }[];
  subtotal: number; discount: number; coupon: { code: string; label: string } | null; couponError: string | null;
  shipping: { zoneId: number; name: string; cost: number; toQuote: boolean } | null;
  shippingOptions: { zoneId: number; name: string; type: 'pickup' | 'zone'; cost: number; eta: string | null; free: boolean; toQuote: boolean }[];
  transferDiscountPct: number; transferDiscount: number; total: number; totalTransfer: number;
};
type Method = 'mercadopago' | 'transfer' | 'whatsapp';

export default function Checkout({ mp, whatsapp, transferPct, hasTransferInfo }: { mp: boolean; whatsapp: boolean; transferPct: number; hasTransferInfo: boolean }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const { items, coupon, setCoupon, clear } = useCart();
  const [form, setForm] = useState({ name: '', email: '', phone: '', postcode: '', province: 'Buenos Aires', city: '', address: '', note: '' });
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>(mp ? 'mercadopago' : 'transfer');
  const [couponInput, setCouponInput] = useState(coupon ?? '');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartKey = useMemo(() => JSON.stringify(items.map((i) => [i.variantId, i.qty])), [items]);

  useEffect(() => {
    if (!hydrated || !items.length) return;
    const t = setTimeout(async () => {
      const r = await fetch('/api/store/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })), couponCode: coupon, postcode: form.postcode || null, province: form.province, zoneId }) });
      const j = await r.json();
      if (!r.ok) { setQErr(j.message ?? 'No pudimos calcular el total'); return; }
      setQErr(null);
      setQuote(j);
      if (!zoneId && j.shippingOptions.length === 1) setZoneId(j.shippingOptions[0].zoneId);
      if (zoneId && !j.shippingOptions.some((o: { zoneId: number }) => o.zoneId === zoneId)) setZoneId(null);
    }, 250);
    return () => clearTimeout(t);
  }, [hydrated, cartKey, coupon, form.postcode, form.province, zoneId, items]);

  if (!hydrated) return <div className="min-h-[60vh]" />;
  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="t-head text-4xl">Tu carrito está vacío</h1>
        <p className="mt-3 text-mute">Elegí tus prendas y volvé para finalizar la compra.</p>
        <Link href="/catalogo" className="btn btn-red mt-6">Ver el catálogo</Link>
      </div>
    );
  }
  const sel = quote?.shippingOptions.find((o) => o.zoneId === zoneId) ?? null;
  const needsAddress = sel?.type === 'zone';
  const total = quote ? (method === 'transfer' ? quote.totalTransfer : quote.total) : 0;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!zoneId) { setError('Elegí cómo querés recibir tu pedido'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/store/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })), paymentMethod: method,
          customer: { name: form.name, email: form.email, phone: form.phone }, zoneId,
          address: needsAddress ? form.address : null, city: needsAddress ? form.city : null, province: needsAddress ? form.province : null, postcode: form.postcode || null,
          couponCode: coupon, note: form.note || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? 'No pudimos crear el pedido');
      clear();
      const statusUrl = `/pedido/${j.number}?t=${j.token}`;
      if (j.payUrl) { window.location.href = j.payUrl; return; }
      if (method === 'whatsapp' && j.whatsappUrl) { window.open(j.whatsappUrl, '_blank', 'noopener'); }
      router.push(statusUrl + (method === 'whatsapp' ? '&wa=1' : ''));
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-7xl gap-10 px-4 pb-24 pt-6 md:px-6 md:pt-10 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h1 className="t-head text-[clamp(2.4rem,7vw,4rem)]">Finalizar compra</h1>
        <Step n="1" title="Tus datos">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" className="sm:col-span-2"><input required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} className="input" /></Field>
            <Field label="Email (te mandamos la confirmación)"><input required type="email" autoComplete="email" value={form.email} onChange={set('email')} className="input" /></Field>
            <Field label="WhatsApp / teléfono"><input required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} className="input" placeholder="2255 123456" /></Field>
          </div>
        </Step>
        <Step n="2" title="Cómo lo recibís">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código postal"><input inputMode="numeric" autoComplete="postal-code" value={form.postcode} onChange={set('postcode')} className="input" placeholder="7165" /></Field>
            <Field label="Provincia"><select value={form.province} onChange={set('province')} className="input">{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          </div>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Forma de entrega">
            {quote?.shippingOptions.map((o) => (
              <label key={o.zoneId} className={clsx('flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 ring-1', zoneId === o.zoneId ? 'ring-2 ring-ink' : 'ring-black/10')}>
                <input type="radio" name="zone" className="h-5 w-5 accent-[var(--color-turf)]" checked={zoneId === o.zoneId} onChange={() => setZoneId(o.zoneId)} />
                <span className="flex-1"><span className="font-semibold">{o.name}</span>{o.eta && <span className="block text-sm text-mute">{o.eta}</span>}</span>
                <span className="t-num">{o.toQuote ? 'A coordinar' : o.cost ? money(o.cost) : 'Gratis'}</span>
              </label>
            ))}
            {quote && !quote.shippingOptions.length && <p className="text-sm text-mute">Ingresá tu código postal para ver las opciones de envío.</p>}
          </div>
          {needsAddress && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Calle y número" className="sm:col-span-2"><input required autoComplete="street-address" value={form.address} onChange={set('address')} className="input" /></Field>
              <Field label="Ciudad / localidad"><input required autoComplete="address-level2" value={form.city} onChange={set('city')} className="input" /></Field>
              {!form.postcode && <p className="self-end text-sm text-turf">Completá el código postal</p>}
            </div>
          )}
        </Step>
        <Step n="3" title="Cómo pagás">
          <div className="space-y-2" role="radiogroup" aria-label="Medio de pago">
            {mp && <PayOption on={method === 'mercadopago'} onChange={() => setMethod('mercadopago')} title="Mercado Pago" body="Tarjeta de crédito o débito, dinero en cuenta. Te llevamos al pago seguro de Mercado Pago." />}
            <PayOption on={method === 'transfer'} onChange={() => setMethod('transfer')} title={`Transferencia${transferPct ? ` · ${transferPct}% off` : ''}`} body={hasTransferInfo ? 'Te mostramos los datos de la cuenta al confirmar y te llegan por mail.' : 'Al confirmar te escribimos con los datos de la cuenta.'} />
            {whatsapp && <PayOption on={method === 'whatsapp'} onChange={() => setMethod('whatsapp')} title="Pedir por WhatsApp" body="Guardamos tu pedido y te abrimos WhatsApp con el mensaje armado para coordinar el pago y el envío." />}
          </div>
          <Field label="Nota para el pedido (opcional)" className="mt-4"><textarea rows={2} value={form.note} onChange={set('note')} className="input min-h-20 py-3" /></Field>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/10 md:p-6">
          <h2 className="t-head text-2xl">Tu pedido</h2>
          <ul className="mt-4 divide-y divide-black/10">
            {items.map((i) => (
              <li key={i.variantId} className="flex gap-3 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-chalk-2">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
                <div className="flex-1"><p className="font-semibold leading-tight">{i.name}</p><p className="t-cond text-sm text-mute">Talle {i.size} · {i.qty} u.</p></div>
                <span className="t-num">{money(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <label htmlFor="cupon" className="sr-only">Cupón de descuento</label>
            <input id="cupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Cupón" className="input h-11 flex-1 uppercase" />
            <button type="button" className="btn btn-ink h-11 min-h-11" onClick={() => setCoupon(couponInput.trim() || null)}>Aplicar</button>
          </div>
          {quote?.couponError && coupon && <p className="mt-1 text-sm text-turf">{quote.couponError}</p>}
          {quote?.coupon && <p className="mt-1 text-sm text-mute">Cupón {quote.coupon.code}: {quote.coupon.label} <button type="button" className="underline" onClick={() => { setCoupon(null); setCouponInput(''); }}>quitar</button></p>}
          {qErr && <p className="mt-3 text-sm text-turf">{qErr}</p>}
          {quote && (
            <dl className="mt-4 space-y-1.5 text-[15px]">
              <Row k="Subtotal" v={money(quote.subtotal)} />
              {quote.discount > 0 && <Row k="Descuento" v={`−${money(quote.discount)}`} />}
              {method === 'transfer' && quote.transferDiscount > 0 && <Row k={`Transferencia (${quote.transferDiscountPct}% off)`} v={`−${money(quote.transferDiscount)}`} />}
              <Row k="Envío" v={sel ? (sel.toQuote ? 'A coordinar' : sel.cost ? money(sel.cost) : 'Gratis') : '—'} />
              <div className="flex items-baseline justify-between border-t border-black/10 pt-3"><dt className="font-semibold">Total</dt><dd className="t-num text-3xl">{money(total)}</dd></div>
            </dl>
          )}
          {error && <p className="mt-3 rounded-xl bg-turf/10 p-3 text-sm text-turf" role="alert">{error}</p>}
          <button type="submit" disabled={sending || !quote} className="btn btn-red mt-5 w-full">
            {sending ? 'Procesando…' : method === 'mercadopago' ? 'Pagar con Mercado Pago' : method === 'whatsapp' ? 'Enviar pedido por WhatsApp' : 'Confirmar pedido'}
          </button>
          <p className="mt-3 text-center text-xs text-mute">Al confirmar aceptás que te contactemos para coordinar el envío.</p>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="t-head flex items-center gap-3 text-2xl"><span className="t-num grid h-8 w-8 place-items-center rounded-full bg-ink text-base not-italic text-white">{n}</span>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={clsx('block', className)}><span className="t-cond mb-1 block text-sm text-mute">{label}</span>{children}</label>;
}
function PayOption({ on, onChange, title, body }: { on: boolean; onChange: () => void; title: string; body: string }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1', on ? 'ring-2 ring-ink' : 'ring-black/10')}>
      <input type="radio" name="pay" className="mt-1 h-5 w-5 accent-[var(--color-turf)]" checked={on} onChange={onChange} />
      <span><span className="font-semibold">{title}</span><span className="block text-sm text-mute">{body}</span></span>
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-mute">{k}</dt><dd className="t-num">{v}</dd></div>;
}
