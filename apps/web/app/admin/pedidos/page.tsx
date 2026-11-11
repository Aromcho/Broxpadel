'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { api, money, STATUS, METHOD } from '@/admin/api';
import { inputCls, PageTitle } from '@/admin/ui';

type O = { id: number; number: string; status: string; paymentMethod: string; customerName: string; customerPhone: string | null; total: number; createdAt: string; items: { name: string; size: string | null; qty: number }[]; shippingName: string | null };

export default function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [d, setD] = useState<{ orders: O[]; counts: Record<string, number> } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api<{ orders: O[]; counts: Record<string, number> }>(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}`).then(setD), 200);
    return () => clearTimeout(t);
  }, [status, q]);
  const total = d ? Object.values(d.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <PageTitle title="Pedidos" />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {[['', `Todos (${total})`], ...Object.entries(STATUS).map(([k, v]) => [k, `${v.label} (${d?.counts[k] ?? 0})`])].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={clsx('h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1', status === k ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white ring-zinc-300')}>{l}</button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, nombre, email o teléfono" className={`${inputCls} mt-2`} />
      <ul className="mt-4 space-y-2">
        {d?.orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/pedidos/${o.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-zinc-200 hover:ring-zinc-400">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-extrabold">{o.number}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span>
                <span className="text-sm text-zinc-500">{METHOD[o.paymentMethod]}</span>
                <span className="ml-auto text-lg font-bold">{money(o.total)}</span>
              </div>
              <p className="mt-1 text-sm"><b>{o.customerName}</b> · {new Date(o.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} · {o.shippingName}</p>
              <p className="mt-0.5 truncate text-sm text-zinc-600">{o.items.map((i) => `${i.qty}× ${i.name} (${i.size})`).join(' · ')}</p>
            </Link>
          </li>
        ))}
        {d && !d.orders.length && <li className="rounded-2xl bg-white p-8 text-center text-zinc-500 ring-1 ring-zinc-200">No hay pedidos con ese filtro.</li>}
      </ul>
    </div>
  );
}
