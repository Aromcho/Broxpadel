/* eslint-disable @next/next/no-img-element */
'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Reorder } from 'motion/react';
import { api } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, Toggle, useToast } from '@/admin/ui';
import { MediaField, MediaPicker, thumb, type MediaRow } from '@/admin/MediaPicker';
import type { Product } from '@/lib/types';


type Opt = { categories: { id: number; name: string }[]; collections: { id: number; name: string }[]; sizeGuides: { id: number; name: string }[]; families: string[] };
type V = { id?: number; size: string; sku: string | null; price: number | null; stock: number; lowStock: number; active: boolean };
type M = { mediaId: number; role: string; thumb: string | null };
type R = { mediaId: number; igUrl: string | null; caption: string | null; thumb: string | null };
type Form = {
  name: string; slug: string; subtitle: string; description: string; features: string[]; categoryId: number | null; price: number; compareAtPrice: number | null;
  family: string; colorName: string; colorHex: string; colorHex2: string; garment: 'tee' | 'shorts' | 'socks' | 'other'; featured: boolean; isNew: boolean; visible: boolean;
  modelId: number | null; usdzId: number | null; sizeGuideId: number | null; seoTitle: string; seoDescription: string;
  variants: V[]; media: M[]; collectionIds: number[]; reels: R[];
};
const EMPTY: Form = { name: '', slug: '', subtitle: '', description: '', features: [], categoryId: null, price: 0, compareAtPrice: null, family: '', colorName: '', colorHex: '#cccccc', colorHex2: '', garment: 'tee', featured: false, isNew: true, visible: false, modelId: null, usdzId: null, sizeGuideId: null, seoTitle: '', seoDescription: '', variants: [], media: [], collectionIds: [], reels: [] };
const ROLES = [['front', 'Frente (portada)'], ['back', 'Espalda'], ['detail', 'Detalle'], ['gallery', 'Galería'], ['lifestyle', 'En uso']];

export default function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'nuevo';
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Form | null>(isNew ? EMPTY : null);
  const [opt, setOpt] = useState<Opt | null>(null);
  const [pick, setPick] = useState<'img' | 'reel' | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<Opt>('/admin/products/meta/options').then(setOpt);
    if (isNew) return;
    api<Product>(`/admin/products/${id}`).then((p) => {
      setF({
        name: p.name, slug: p.slug, subtitle: p.subtitle ?? '', description: p.description ?? '', features: p.features, categoryId: p.category?.id ?? null, price: p.price, compareAtPrice: p.compareAtPrice,
        family: p.family ?? '', colorName: p.colorName ?? '', colorHex: p.colorHex ?? '#cccccc', colorHex2: p.colorHex2 ?? '', garment: p.garment, featured: p.featured, isNew: p.isNew, visible: p.visible,
        modelId: p.model?.id ?? null, usdzId: p.model?.usdzId ?? null, sizeGuideId: p.sizeGuide?.id ?? null, seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '',
        variants: p.variants.map((v) => ({ id: v.id, size: v.size, sku: v.sku, price: v.price === p.price ? null : v.price, stock: v.stock, lowStock: v.lowStock, active: v.active })),
        media: p.images.map((i) => ({ mediaId: i.id, role: i.role ?? 'gallery', thumb: i.variants.find((v) => v.w >= 320)?.url ?? i.url })),
        collectionIds: p.collections.map((c) => c.id),
        reels: p.reels.map((r) => ({ mediaId: r.video.id, igUrl: r.igUrl, caption: r.caption, thumb: r.video.poster?.variants?.find((v) => v.w >= 320)?.url ?? null })),
      });
    });
  }, [id, isNew]);
  if (!f || !opt) return <p className="text-zinc-500">Cargando…</p>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...f, compareAtPrice: f.compareAtPrice || null, colorHex2: f.colorHex2 || null, family: f.family || null,
        variants: f.variants.map((v) => ({ ...v, price: v.price || null, stock: Number(v.stock), lowStock: Number(v.lowStock) })),
        media: f.media.map(({ mediaId, role }) => ({ mediaId, role })), reels: f.reels.map(({ mediaId, igUrl, caption }) => ({ mediaId, igUrl, caption })),
      };
      const p = await api<Product>(isNew ? '/admin/products' : `/admin/products/${id}`, { method: isNew ? 'POST' : 'PATCH', json: body });
      toast('Producto guardado. Ya se ve en la tienda.');
      if (isNew) router.replace(`/admin/productos/${p.id}`);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setSaving(false); }
  };
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', 'Único'];
  return (
    <div className="pb-20">
      <Link href="/admin/productos" className="text-sm underline">← Productos</Link>
      <PageTitle title={isNew ? 'Nuevo producto' : f.name}>
        {!isNew && <a href={`/producto/${f.slug}`} target="_blank" rel="noopener"><Btn tone="light">Ver en la tienda</Btn></a>}
        {!isNew && <Btn tone="light" onClick={async () => { const p = await api<Product>(`/admin/products/${id}/duplicate`, { method: 'POST' }); router.push(`/admin/productos/${p.id}`); }}>Duplicar</Btn>}
        <Btn tone="red" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </PageTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Datos">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre" className="md:col-span-2"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Precio"><input type="number" className={inputCls} value={f.price} onChange={(e) => set('price', Number(e.target.value))} /></Field>
              <Field label="Precio tachado (opcional)"><input type="number" className={inputCls} value={f.compareAtPrice ?? ''} onChange={(e) => set('compareAtPrice', e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Categoría"><select className={inputCls} value={f.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}><option value="">—</option>{opt.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Tipo de prenda"><select className={inputCls} value={f.garment} onChange={(e) => set('garment', e.target.value as Form['garment'])}><option value="tee">Remera</option><option value="shorts">Short</option><option value="socks">Medias</option><option value="other">Otro</option></select></Field>
              <Field label="Descripción" className="md:col-span-2"><textarea className={`${inputCls} min-h-28 py-2`} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Características (una por línea)" className="md:col-span-2"><textarea className={`${inputCls} min-h-24 py-2`} value={f.features.join('\n')} onChange={(e) => set('features', e.target.value.split('\n'))} /></Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-5"><Toggle checked={f.visible} onChange={(v) => set('visible', v)} label="Visible en la tienda" /><Toggle checked={f.featured} onChange={(v) => set('featured', v)} label="Destacado" /><Toggle checked={f.isNew} onChange={(v) => set('isNew', v)} label="Etiqueta “Nuevo”" /></div>
          </Card>

          <Card title="Talles, stock y SKU" actions={<div className="flex gap-1">{['XS-XXXL', 'Único'].map((t) => <Btn key={t} tone="ghost" onClick={() => set('variants', [...f.variants, ...(t === 'Único' ? ['Único'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).filter((s) => !f.variants.some((v) => v.size === s)).map((s) => ({ size: s, sku: null, price: null, stock: 0, lowStock: 2, active: true }))])}>+ {t}</Btn>)}</div>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-zinc-500"><th className="p-1">Talle</th><th className="p-1">Stock</th><th className="p-1">Avisar con</th><th className="p-1">SKU</th><th className="p-1">Precio propio</th><th className="p-1">Activo</th><th /></tr></thead>
                <tbody>
                  {f.variants.map((v, i) => {
                    const up = (patch: Partial<V>) => set('variants', f.variants.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={v.id ?? `n${i}`}>
                        <td className="p-1"><input list="sizes" className={`${inputCls} w-20`} value={v.size} onChange={(e) => up({ size: e.target.value })} /></td>
                        <td className="p-1"><input type="number" min={0} className={`${inputCls} w-20 ${v.stock <= v.lowStock ? 'ring-amber-400' : ''}`} value={v.stock} onChange={(e) => up({ stock: Number(e.target.value) })} /></td>
                        <td className="p-1"><input type="number" min={0} className={`${inputCls} w-16`} value={v.lowStock} onChange={(e) => up({ lowStock: Number(e.target.value) })} /></td>
                        <td className="p-1"><input className={`${inputCls} w-32`} value={v.sku ?? ''} onChange={(e) => up({ sku: e.target.value || null })} /></td>
                        <td className="p-1"><input type="number" className={`${inputCls} w-28`} placeholder="—" value={v.price ?? ''} onChange={(e) => up({ price: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td className="p-1"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => up({ active: e.target.checked })} aria-label="Activo" /></td>
                        <td className="p-1"><button className="h-11 w-11 text-zinc-400 hover:text-[#d9161d]" onClick={() => set('variants', f.variants.filter((_, k) => k !== i))} aria-label="Quitar talle">✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="sizes">{SIZES.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <Btn tone="light" className="mt-2" onClick={() => set('variants', [...f.variants, { size: '', sku: null, price: null, stock: 0, lowStock: 2, active: true }])}>+ Talle</Btn>
          </Card>

          <Card title="Fotos" actions={<Btn tone="light" onClick={() => setPick('img')}>+ Agregar fotos</Btn>}>
            <p className="mb-2 text-sm text-zinc-500">Arrastrá para ordenar. La primera es la portada del catálogo.</p>
            <Reorder.Group axis="y" values={f.media} onReorder={(m) => set('media', m)} className="space-y-2">
              {f.media.map((m, i) => (
                <Reorder.Item key={m.mediaId} value={m} className="flex cursor-grab items-center gap-3 rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200 active:cursor-grabbing">
                  <span className="w-5 text-center text-sm font-bold text-zinc-400">{i + 1}</span>
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{m.thumb && <img src={m.thumb} alt="" className="h-full w-full object-cover" draggable={false} />}</div>
                  <select className={`${inputCls} flex-1`} value={m.role} onChange={(e) => set('media', f.media.map((x) => (x.mediaId === m.mediaId ? { ...x, role: e.target.value } : x)))}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <button className="h-11 w-11 text-zinc-400 hover:text-[#d9161d]" onClick={() => set('media', f.media.filter((x) => x.mediaId !== m.mediaId))} aria-label="Quitar foto">✕</button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </Card>

          <Card title="Videos de la prenda" actions={<Btn tone="light" onClick={() => setPick('reel')}>+ Agregar video</Btn>}>
            {!f.reels.length && <p className="text-sm text-zinc-500">Sumá videos donde se vea la prenda en la cancha: en la ficha aparecen antes que las fotos y en el catálogo se reproducen al pasar el mouse.</p>}
            <ul className="space-y-2">
              {f.reels.map((r, i) => (
                <li key={r.mediaId} className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200">
                  <div className="aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{r.thumb && <img src={r.thumb} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="grid flex-1 gap-2 md:grid-cols-2">
                    <input className={inputCls} placeholder="Texto" value={r.caption ?? ''} onChange={(e) => set('reels', f.reels.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} />
                    <input className={inputCls} placeholder="Link del reel en Instagram" value={r.igUrl ?? ''} onChange={(e) => set('reels', f.reels.map((x, k) => (k === i ? { ...x, igUrl: e.target.value } : x)))} />
                  </div>
                  <button className="h-11 w-11 text-zinc-400 hover:text-[#d9161d]" onClick={() => set('reels', f.reels.filter((_, k) => k !== i))} aria-label="Quitar video">✕</button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Color y familia">
            <div className="grid gap-3">
              <Field label="Familia (agrupa los colores de un mismo modelo)" hint="Ej: remera-secado-rapido"><input list="fam" className={inputCls} value={f.family} onChange={(e) => set('family', e.target.value)} /><datalist id="fam">{opt.families.map((x) => <option key={x} value={x} />)}</datalist></Field>
              <Field label="Nombre del color"><input className={inputCls} value={f.colorName} onChange={(e) => set('colorName', e.target.value)} /></Field>
              <div className="flex gap-3">
                <Field label="Color"><input type="color" className="h-11 w-20 rounded-xl" value={f.colorHex || '#cccccc'} onChange={(e) => set('colorHex', e.target.value)} /></Field>
                <Field label="Degradé (opcional)"><input type="color" className="h-11 w-20 rounded-xl" value={f.colorHex2 || '#ffffff'} onChange={(e) => set('colorHex2', e.target.value)} /></Field>
                {f.colorHex2 && <Btn tone="ghost" className="self-end" onClick={() => set('colorHex2', '')}>Sin degradé</Btn>}
              </div>
            </div>
          </Card>
          <Card title="Colecciones y talles">
            <div className="space-y-1">{opt.collections.map((c) => <Toggle key={c.id} checked={f.collectionIds.includes(c.id)} onChange={(v) => set('collectionIds', v ? [...f.collectionIds, c.id] : f.collectionIds.filter((x) => x !== c.id))} label={c.name} />)}</div>
            <Field label="Guía de talles" className="mt-3"><select className={inputCls} value={f.sizeGuideId ?? ''} onChange={(e) => set('sizeGuideId', e.target.value ? Number(e.target.value) : null)}><option value="">Sin guía</option>{opt.sizeGuides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          </Card>
          <Card title="SEO">
            <div className="grid gap-3">
              <Field label="URL"><input className={inputCls} value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="se arma con el nombre" /></Field>
              <Field label="Título para Google"><input className={inputCls} value={f.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} /></Field>
              <Field label="Descripción para Google"><textarea className={`${inputCls} min-h-20 py-2`} value={f.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} /></Field>
            </div>
          </Card>
          {!isNew && <Btn tone="ghost" className="text-[#d9161d]" onClick={async () => { if (confirm(`¿Eliminar “${f.name}”? Los pedidos viejos se conservan.`)) { await api(`/admin/products/${id}`, { method: 'DELETE' }); router.replace('/admin/productos'); } }}>Eliminar producto</Btn>}
        </div>
      </div>
      <MediaPicker open={pick === 'img'} multiple kind="image" onClose={() => setPick(null)} onPick={(rows: MediaRow[]) => set('media', [...f.media, ...rows.filter((r) => !f.media.some((m) => m.mediaId === r.id)).map((r) => ({ mediaId: r.id, role: f.media.length ? 'gallery' : 'front', thumb: thumb(r) }))])} />
      <MediaPicker open={pick === 'reel'} kind="video" onClose={() => setPick(null)} onPick={(rows) => set('reels', [...f.reels, ...rows.map((r) => ({ mediaId: r.id, igUrl: null, caption: r.title, thumb: thumb(r) }))])} />
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-5xl justify-end gap-2"><Link href="/admin/productos"><Btn tone="light">Volver</Btn></Link><Btn tone="red" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Btn></div>
      </div>
    </div>
  );
}
