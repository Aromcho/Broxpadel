/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, STATUS, METHOD } from '@/admin/api';
import { Card, PageTitle } from '@/admin/ui';
import { useUser } from '@/admin/Shell';

type Dash = {
  sales: { today: number; week: number; month: number; ordersMonth: number; avgTicket: number };
  series: { day: string; total: number; orders: number }[];
  counts: Record<string, number>;
  top: { name: string; qty: number; total: number }[];
  lowStock: { productId: number; name: string; size: string; stock: number; image: string | null }[];
  activity: { id: number; userName: string | null; summary: string | null; createdAt: string }[];
  catalog: { products: number; visible: number; with3d: number };
  pending: { id: number; number: string; customerName: string; total: number; status: string; paymentMethod: string; createdAt: string }[];
};
const ago = (d: string) => {
  const s = (Date.now() - +new Date(d)) / 1000;
  return s < 60 ? 'recién' : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : `hace ${Math.round(s / 86400)} d`;
};

export default function Dashboard() {
  const user = useUser();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { api<Dash>('/admin/dashboard').then(setD); }, []);
  if (!d) return <p className="text-zinc-500">Cargando…</p>;
  const max = Math.max(1, ...d.series.map((s) => s.total));
  const pendingN = (d.counts.pending_payment ?? 0) + (d.counts.paid ?? 0) + (d.counts.preparing ?? 0);
  return (
    <div>
      <PageTitle title={`Hola, ${user?.name.split(' ')[0] ?? ''}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ventas hoy" value={money(d.sales.today)} />
        <Stat label="Últimos 7 días" value={money(d.sales.week)} />
        <Stat label="Últimos 30 días" value={money(d.sales.month)} sub={`${d.sales.ordersMonth} pedidos · ticket ${money(d.sales.avgTicket)}`} />
        <Link href="/admin/pedidos"><Stat label="Pedidos para atender" value={String(pendingN)} sub="Pendientes, pagados y en preparación" accent={pendingN > 0} /></Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Ventas de los últimos 30 días">
          <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Ventas por día, máximo ${money(max)}`}>
            {d.series.map((s) => (
              <div key={s.day} className="group relative flex-1">
                <div className="rounded-t bg-[#d9161d]/85 transition group-hover:bg-[#d9161d]" style={{ height: `${Math.max(2, (s.total / max) * 150)}px` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block">{s.day.slice(5)} · {money(s.total)} · {s.orders} ped.</span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-zinc-500"><span>{d.series[0]?.day.slice(5)}</span><span>hoy</span></div>
        </Card>
        <Card title="Stock bajo" actions={<Link href="/admin/productos" className="text-sm underline">Productos</Link>}>
          {d.lowStock.length ? (
            <ul className="divide-y divide-zinc-100">
              {d.lowStock.slice(0, 8).map((l, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}</div>
                  <Link href={`/admin/productos/${l.productId}`} className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</Link>
                  <span className="text-sm text-zinc-600">Talle {l.size}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.stock <= 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{l.stock <= 0 ? 'Sin stock' : `Quedan ${l.stock}`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">Todo con stock. 👌</p>}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Pedidos recientes" className="lg:col-span-2" actions={<Link href="/admin/pedidos" className="text-sm underline">Ver todos</Link>}>
          {d.pending.length ? (
            <ul className="divide-y divide-zinc-100">
              {d.pending.map((o) => (
                <li key={o.id}><Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="font-bold">{o.number}</span><span className="text-zinc-600">{o.customerName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span>
                  <span className="text-xs text-zinc-500">{METHOD[o.paymentMethod]} · {ago(o.createdAt)}</span>
                  <span className="ml-auto font-semibold">{money(o.total)}</span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">Todavía no hay pedidos. Cuando entren, los vas a ver acá.</p>}
        </Card>
        <Card title="Más vendidos (30 días)">
          {d.top.length ? <ol className="space-y-2">{d.top.map((t) => <li key={t.name} className="flex justify-between gap-2 text-sm"><span className="truncate">{t.name}</span><span className="shrink-0 font-semibold">{t.qty} u.</span></li>)}</ol> : <p className="text-sm text-zinc-500">Sin ventas todavía.</p>}
          <p className="mt-4 text-sm text-zinc-500">Catálogo: {d.catalog.visible}/{d.catalog.products} visibles · {d.catalog.with3d} con 3D</p>
        </Card>
      </div>
      <Card title="Actividad" className="mt-4">
        <ul className="divide-y divide-zinc-100 text-sm">
          {d.activity.map((a) => <li key={a.id} className="flex gap-3 py-2"><span className="w-24 shrink-0 text-zinc-500">{ago(a.createdAt)}</span><span><b>{a.userName}</b> · {a.summary}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`h-full rounded-2xl p-4 ring-1 ${accent ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white ring-zinc-200'}`}>
      <p className={`text-sm ${accent ? 'text-white/70' : 'text-zinc-500'}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? 'text-white/60' : 'text-zinc-500'}`}>{sub}</p>}
    </div>
  );
}
