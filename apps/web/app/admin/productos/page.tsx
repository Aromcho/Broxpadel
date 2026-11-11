/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Reorder, useDragControls } from 'motion/react';
import { api, money } from '@/admin/api';
import { Btn, inputCls, PageTitle, Toggle, useToast } from '@/admin/ui';
import type { Product } from '@/lib/types';

export default function Products() {
  const [list, setList] = useState<Product[] | null>(null);
  const [q, setQ] = useState('');
  const toast = useToast();
  const load = () => api<Product[]>('/admin/products').then(setList);
  useEffect(() => { load(); }, []);
  const quick = async (p: Product, body: Record<string, unknown>, msg: string) => {
    try { const np = await api<Product>(`/admin/products/${p.id}/quick`, { method: 'PATCH', json: body }); setList((l) => l!.map((x) => (x.id === p.id ? np : x))); toast(msg); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const shown = (list ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle title="Productos"><Link href="/admin/productos/nuevo"><Btn tone="red">+ Nuevo producto</Btn></Link></PageTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" className={inputCls} />
      {!list ? <p className="mt-4 text-zinc-500">Cargando…</p> : (
        <Reorder.Group axis="y" values={list} onReorder={setList} className="mt-4 space-y-2">
          {shown.map((p) => <Row key={p.id} p={p} canDrag={!q} onDrop={() => api('/admin/products/order', { method: 'PUT', json: { ids: list.map((x) => x.id) } }).then(() => toast('Orden guardado'))} quick={quick} />)}
        </Reorder.Group>
      )}
    </div>
  );
}

function Row({ p, canDrag, onDrop, quick }: { p: Product; canDrag: boolean; onDrop: () => void; quick: (p: Product, b: Record<string, unknown>, m: string) => void }) {
  const ctl = useDragControls();
  const [open, setOpen] = useState(false);
  const img = p.images[0]?.variants?.find((v) => v.w >= 320)?.url;
  const low = p.variants.filter((v) => v.active && v.stock <= v.lowStock).length;
  return (
    <Reorder.Item value={p} dragListener={false} dragControls={ctl} onDragEnd={onDrop} className="rounded-2xl bg-white ring-1 ring-zinc-200">
      <div className="flex items-center gap-3 p-3">
        {canDrag && <button className="grid h-11 w-6 shrink-0 cursor-grab touch-none place-items-center text-zinc-400" onPointerDown={(e) => ctl.start(e)} aria-label="Arrastrar para ordenar">⋮⋮</button>}
        <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{img && <img src={img} alt="" className="h-full w-full object-cover" />}</div>
        <Link href={`/admin/productos/${p.id}`} className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-sm text-zinc-500">{money(p.price)} · {p.category?.name ?? 'Sin categoría'} · stock {p.totalStock}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {!p.visible && <span className="rounded-full bg-zinc-100 px-2 text-xs font-semibold text-zinc-600">Oculto</span>}
            {p.featured && <span className="rounded-full bg-zinc-900 px-2 text-xs font-semibold text-white">Destacado</span>}
            {low > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">{low} talle{low > 1 ? 's' : ''} con stock bajo</span>}
          </div>
        </Link>
        <Btn tone="light" onClick={() => setOpen(!open)} aria-expanded={open}>Stock</Btn>
      </div>
      {open && (
        <div className="border-t border-zinc-100 p-3">
          <div className="flex flex-wrap gap-2">
            {p.variants.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200">
                <span className="w-10 text-sm font-semibold">{v.size}</span>
                <input type="number" min={0} defaultValue={v.stock} className="h-10 w-16 rounded-lg bg-white px-2 ring-1 ring-zinc-300" aria-label={`Stock talle ${v.size}`}
                  onBlur={(e) => Number(e.target.value) !== v.stock && quick(p, { variant: { id: v.id, stock: Number(e.target.value) } }, `Stock ${v.size}: ${e.target.value}`)} />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Toggle checked={p.visible} onChange={(x) => quick(p, { visible: x }, x ? 'Visible en la tienda' : 'Oculto')} label="Visible" />
            <Toggle checked={p.featured} onChange={(x) => quick(p, { featured: x }, x ? 'Destacado' : 'Ya no está destacado')} label="Destacado" />
            <Toggle checked={p.isNew} onChange={(x) => quick(p, { isNew: x }, 'Guardado')} label="Nuevo" />
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}
