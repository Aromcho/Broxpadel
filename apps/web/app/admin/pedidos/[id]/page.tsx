/* eslint-disable @next/next/no-img-element */
'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { api, money, STATUS, METHOD } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, useToast } from '@/admin/ui';

type D = {
  order: Record<string, string | number | boolean | null> & { id: number; number: string; status: string; paymentMethod: string; total: number; subtotal: number; discount: number; transferDiscount: number; shippingCost: number; shippingToQuote: boolean };
  items: { id: number; name: string; size: string | null; qty: number; unitPrice: number; image: string | null; sku: string | null }[];
  events: { id: number; type: string; message: string | null; by: string | null; createdAt: string }[];
  replyWhatsapp: string | null;
};
const FLOW = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered'];

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<D | null>(null);
  const [notes, setNotes] = useState('');
  const [note, setNote] = useState('');
  const [track, setTrack] = useState({ code: '', url: '' });
  const toast = useToast();
  const load = () => api<D>(`/admin/orders/${id}`).then((r) => { setD(r); setNotes(String(r.order.adminNotes ?? '')); setTrack({ code: String(r.order.trackingCode ?? ''), url: String(r.order.trackingUrl ?? '') }); });
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = async (body: Record<string, unknown>, msg: string) => {
    try { const r = await api<D>(`/admin/orders/${id}`, { method: 'PATCH', json: body }); setD(r); toast(msg); } catch (e) { toast((e as Error).message, 'err'); }
  };
  if (!d) return <p className="text-zinc-500">Cargando…</p>;
  const o = d.order;
  const idx = FLOW.indexOf(o.status);
  return (
    <div>
      <Link href="/admin/pedidos" className="text-sm underline">← Pedidos</Link>
      <PageTitle title={`Pedido ${o.number}`}>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span>
        {d.replyWhatsapp && <a href={d.replyWhatsapp} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl bg-[#25D366] px-4 font-semibold text-white">Responder por WhatsApp</a>}
      </PageTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Estado">
            <div className="flex flex-wrap gap-2">
              {FLOW.map((s, i) => (
                <Btn key={s} tone={o.status === s ? 'dark' : 'light'} className={clsx(i < idx && 'opacity-60')} onClick={() => o.status !== s && upd({ status: s }, `Pedido ${STATUS[s].label.toLowerCase()}`)}>{STATUS[s].label}</Btn>
              ))}
              <Btn tone="ghost" className="text-[#d9161d]" onClick={() => o.status !== 'cancelled' && confirm('¿Cancelar el pedido? El stock vuelve a estar disponible.') && upd({ status: 'cancelled' }, 'Pedido cancelado')}>Cancelar</Btn>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Al cambiar el estado le llega un mail al cliente. Los pagos de Mercado Pago se marcan solos.</p>
          </Card>
          <Card title="Productos">
            <ul className="divide-y divide-zinc-100">
              {d.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex-1"><p className="font-semibold">{i.name}</p><p className="text-sm text-zinc-500">Talle {i.size} · {i.qty} u. · {i.sku}</p></div>
                  <span className="font-semibold">{money(i.unitPrice * i.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt>Cupón {o.couponCode}</dt><dd>−{money(o.discount)}</dd></div>}
              {o.transferDiscount > 0 && <div className="flex justify-between"><dt>Desc. transferencia</dt><dd>−{money(o.transferDiscount)}</dd></div>}
              <div className="flex justify-between"><dt>{String(o.shippingName)}</dt><dd>{o.shippingToQuote ? 'A coordinar' : money(o.shippingCost)}</dd></div>
              <div className="flex justify-between text-lg font-extrabold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
            </dl>
          </Card>
          <Card title="Historial">
            <ul className="space-y-2 text-sm">
              {d.events.map((e) => <li key={e.id} className="flex gap-3"><span className="w-32 shrink-0 text-zinc-500">{new Date(e.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span><span>{e.message} <span className="text-zinc-400">· {e.by}</span></span></li>)}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { upd({ note }, 'Nota agregada'); setNote(''); } }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar una nota al historial" className={inputCls} />
              <Btn>Agregar</Btn>
            </form>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Cliente">
            <p className="font-semibold">{String(o.customerName)}</p>
            {o.customerEmail && <p className="text-sm"><a className="underline" href={`mailto:${o.customerEmail}`}>{String(o.customerEmail)}</a></p>}
            {o.customerPhone && <p className="text-sm">{String(o.customerPhone)}</p>}
            <p className="mt-2 text-sm text-zinc-600">{METHOD[o.paymentMethod]}{o.mpPaymentId ? ` · pago #${o.mpPaymentId} (${o.mpStatus})` : ''}</p>
            {o.address && <p className="mt-2 text-sm">{String(o.address)}, {String(o.city)} ({String(o.postcode)}), {String(o.province)}</p>}
            {o.customerNote && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">“{String(o.customerNote)}”</p>}
          </Card>
          <Card title="Envío">
            <div className="grid gap-3">
              <Field label="Código de seguimiento"><input className={inputCls} value={track.code} onChange={(e) => setTrack({ ...track, code: e.target.value })} /></Field>
              <Field label="Link de seguimiento"><input className={inputCls} value={track.url} onChange={(e) => setTrack({ ...track, url: e.target.value })} placeholder="https://…" /></Field>
              <Btn onClick={() => upd({ trackingCode: track.code || null, trackingUrl: track.url || null, ...(track.code && o.status !== 'shipped' && o.status !== 'delivered' ? { status: 'shipped' } : {}) }, 'Seguimiento guardado')}>Guardar{track.code && o.status !== 'shipped' && o.status !== 'delivered' ? ' y marcar enviado' : ''}</Btn>
            </div>
          </Card>
          <Card title="Notas internas">
            <textarea className={`${inputCls} min-h-28 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Solo las ve el equipo" />
            <Btn className="mt-2" tone="light" onClick={() => upd({ adminNotes: notes }, 'Notas guardadas')}>Guardar notas</Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}
