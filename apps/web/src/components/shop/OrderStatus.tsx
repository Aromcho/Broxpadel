/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { money } from '@/lib/format';

type Data = {
  order: { number: string; status: string; paymentMethod: string; customerName: string; total: number; subtotal: number; discount: number; transferDiscount: number; shippingCost: number; shippingToQuote: boolean; shippingName: string | null; trackingCode: string | null; trackingUrl: string | null; createdAt: string; mpStatus: string | null };
  items: { id: number; name: string; size: string | null; qty: number; unitPrice: number; image: string | null }[];
  events: { id: number; type: string; message: string | null; createdAt: string }[];
  whatsappUrl: string | null; transferInfo: string | null;
};
const STEPS = [
  { k: 'pending_payment', l: 'Recibido' }, { k: 'paid', l: 'Pagado' }, { k: 'preparing', l: 'Preparando' }, { k: 'shipped', l: 'Enviado' }, { k: 'delivered', l: 'Entregado' },
];

export default function OrderStatus({ number }: { number: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get('t') ?? '';
    const pid = sp.get('payment_id') ?? sp.get('collection_id');
    const load = pid
      ? fetch(`/api/store/orders/${number}/sync?t=${t}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentId: pid }) })
      : fetch(`/api/store/orders/${number}?t=${t}`);
    load.then(async (r) => { if (!r.ok) throw new Error('No encontramos el pedido'); setD(await r.json()); }).catch((e) => setErr(e.message));
  }, [number]);
  if (err) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="t-head text-4xl">{err}</h1><Link href="/" className="btn btn-ink mt-6">Volver a la tienda</Link></div>;
  if (!d) return <div className="min-h-[60vh]" aria-busy="true" />;
  const o = d.order;
  const cancelled = o.status === 'cancelled';
  const idx = STEPS.findIndex((s) => s.k === o.status);
  const retry = async () => {
    setPaying(true);
    const t = new URLSearchParams(location.search).get('t') ?? '';
    const r = await fetch(`/api/store/orders/${number}/pay?t=${t}`, { method: 'POST' });
    const j = await r.json();
    if (j.payUrl) window.location.href = j.payUrl; else setPaying(false);
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:pt-12">
      <p className="t-cond text-mute">Pedido {o.number}</p>
      <h1 className="t-head mt-1 text-[clamp(2.4rem,7vw,4rem)]">
        {cancelled ? 'Pedido cancelado' : o.status === 'pending_payment' ? `¡Gracias, ${o.customerName.split(' ')[0]}!` : 'Tu pedido está en marcha'}
      </h1>
      {!cancelled && (
        <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Estado">
          {STEPS.map((s, i) => (
            <li key={s.k} className="text-center">
              <span className={clsx('block h-1.5 rounded-full', i <= idx ? 'bg-turf' : 'bg-black/10')} />
              <span className={clsx('t-cond mt-2 block text-xs sm:text-sm', i === idx ? 'text-ink' : 'text-mute')}>{s.l}</span>
            </li>
          ))}
        </ol>
      )}
      {o.status === 'pending_payment' && o.paymentMethod === 'mercadopago' && (
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-black/10">
          <p>Todavía no recibimos la confirmación de Mercado Pago{o.mpStatus ? ` (${o.mpStatus.split('/')[0]})` : ''}.</p>
          <button onClick={retry} disabled={paying} className="btn btn-red mt-3">{paying ? 'Abriendo…' : 'Pagar con Mercado Pago'}</button>
        </div>
      )}
      {o.status === 'pending_payment' && o.paymentMethod === 'transfer' && (
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-black/10">
          <h2 className="t-head text-xl">Datos para transferir</h2>
          {d.transferInfo ? <p className="mt-2 whitespace-pre-line">{d.transferInfo}</p> : <p className="mt-2 text-mute">Te escribimos por WhatsApp con los datos de la cuenta.</p>}
          <p className="mt-2">Monto: <span className="t-num">{money(o.total)}</span>. Mandanos el comprobante indicando el pedido <b>{o.number}</b>.</p>
          {d.whatsappUrl && <a href={d.whatsappUrl} target="_blank" rel="noopener" className="btn btn-ink mt-3">Enviar comprobante por WhatsApp</a>}
        </div>
      )}
      {o.paymentMethod === 'whatsapp' && o.status === 'pending_payment' && d.whatsappUrl && (
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-black/10">
          <p>Guardamos tu pedido. Si no se abrió WhatsApp, tocá el botón para mandarnos el mensaje.</p>
          <a href={d.whatsappUrl} target="_blank" rel="noopener" className="btn btn-red mt-3">Abrir WhatsApp</a>
        </div>
      )}
      {o.trackingCode && (
        <p className="mt-6 rounded-2xl bg-ball/40 p-4">Código de seguimiento: <b>{o.trackingCode}</b> {o.trackingUrl && <a className="underline" href={o.trackingUrl} target="_blank" rel="noopener">Seguir el envío</a>}</p>
      )}
      <ul className="mt-8 divide-y divide-black/10 rounded-2xl bg-white px-5 ring-1 ring-black/10">
        {d.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-chalk-2">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
            <span className="flex-1">{i.name} <span className="t-cond text-sm text-mute">· Talle {i.size} · {i.qty} u.</span></span>
            <span className="t-num">{money(i.unitPrice * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between py-3 text-mute"><span>{o.shippingName}</span><span className="t-num">{o.shippingToQuote ? 'A coordinar' : o.shippingCost ? money(o.shippingCost) : 'Gratis'}</span></li>
        {o.discount + o.transferDiscount > 0 && <li className="flex justify-between py-3 text-mute"><span>Descuentos</span><span className="t-num">−{money(o.discount + o.transferDiscount)}</span></li>}
        <li className="flex justify-between py-3 font-semibold"><span>Total</span><span className="t-num text-xl">{money(o.total)}</span></li>
      </ul>
      <Link href="/catalogo" className="btn btn-ghost mt-8">Seguir mirando</Link>
    </div>
  );
}
