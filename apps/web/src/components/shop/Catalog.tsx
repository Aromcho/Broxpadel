'use client';
import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import type { Category, Collection, Product } from '@/lib/types';
import { money } from '@/lib/format';
import ProductCard from './ProductCard';

const CatalogCanvas = dynamic(() => import('@/three/garment/CatalogCanvas'), { ssr: false });

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SIZE_ORDER = ['2', '4', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Único'];
type Sort = 'destacados' | 'precio-asc' | 'precio-desc' | 'nuevos';
export type Filters = { categoria?: string; coleccion?: string; talle?: string; color?: string; precio?: string; q?: string; orden?: Sort };

export default function Catalog({ products, categories, collections, initial, transferPct, limit, syncUrl = true, heading }: {
  products: Product[]; categories: Category[]; collections: Collection[]; initial: Filters; transferPct: number; limit?: number; syncUrl?: boolean; heading?: React.ReactNode;
}) {
  const [f, setF] = useState<Filters>(initial);
  const [panel, setPanel] = useState(false);
  const [view3d, setView3d] = useState(false);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!syncUrl) return;
    const sp = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && sp.set(k, String(v)));
    const qs = sp.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [f, syncUrl, path, router]);

  const sizes = useMemo(() => [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)), [products]);
  const colors = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => p.colorName && !m.has(norm(p.colorName)) && m.set(norm(p.colorName), p.colorHex ?? '#ccc'));
    return [...m.entries()].map(([k, hex]) => ({ key: k, hex, label: products.find((p) => norm(p.colorName ?? '') === k)!.colorName! }));
  }, [products]);
  const prices = useMemo(() => [...new Set(products.map((p) => p.price))].sort((a, b) => a - b), [products]);

  const list = useMemo(() => {
    let l = products;
    if (f.categoria) l = l.filter((p) => p.category?.slug === f.categoria);
    if (f.coleccion) l = l.filter((p) => p.collections.some((c) => c.slug === f.coleccion));
    if (f.talle) l = l.filter((p) => p.variants.some((v) => v.size === f.talle && v.available));
    if (f.color) l = l.filter((p) => norm(p.colorName ?? '') === f.color);
    if (f.precio) l = l.filter((p) => p.price === Number(f.precio));
    if (f.q) {
      const t = norm(f.q).split(/\s+/).filter(Boolean);
      l = l.filter((p) => { const h = norm([p.name, p.colorName, p.category?.name, p.description, p.collections.map((c) => c.name).join(' ')].join(' ')); return t.every((x) => h.includes(x)); });
    }
    const s = [...l];
    if (f.orden === 'precio-asc') s.sort((a, b) => a.price - b.price);
    else if (f.orden === 'precio-desc') s.sort((a, b) => b.price - a.price);
    else if (f.orden === 'nuevos') s.sort((a, b) => Number(b.isNew) - Number(a.isNew) || +new Date(b.createdAt) - +new Date(a.createdAt));
    else s.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
    return s;
  }, [products, f]);
  const shown = limit ? list.slice(0, limit) : list;
  const active = Object.entries(f).filter(([k, v]) => v && k !== 'orden' && k !== 'categoria');
  const set = (patch: Filters) => setF((o) => ({ ...o, ...patch }));

  return (
    <div>
      {heading}
      {view3d && <CatalogCanvas />}
      <div className="sticky top-14 z-20 -mx-4 bg-chalk/95 px-4 py-3 backdrop-blur md:top-16 md:mx-0 md:px-0">
        <div className="flex items-center gap-2">
          <div className="no-scrollbar -my-1 flex flex-1 gap-2 overflow-x-auto py-1" role="group" aria-label="Categorías">
            <Chip on={!f.categoria} onClick={() => set({ categoria: undefined })}>Todo</Chip>
            {categories.map((c) => (
              <Chip key={c.slug} on={f.categoria === c.slug} onClick={() => set({ categoria: f.categoria === c.slug ? undefined : c.slug })}>{c.name}</Chip>
            ))}
          </div>
          <button onClick={() => setPanel(true)} className="t-cond flex h-10 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-white" aria-expanded={panel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filtrar{active.length ? ` (${active.length})` : ''}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <p className="t-cond text-mute" aria-live="polite">{list.length} {list.length === 1 ? 'prenda' : 'prendas'}{f.q ? ` para “${f.q}”` : ''}</p>
          <label className="flex cursor-pointer select-none items-center gap-2">
            <span className="t-cond">Vista 3D</span>
            <input type="checkbox" className="peer sr-only" checked={view3d} onChange={(e) => setView3d(e.target.checked)} />
            <span className="relative h-6 w-11 rounded-full bg-black/15 transition peer-checked:bg-turf peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>
        {active.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {active.map(([k, v]) => (
              <button key={k} onClick={() => set({ [k]: undefined } as Filters)} className="t-cond flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-black/10">
                {k === 'precio' ? money(Number(v)) : k === 'color' ? colors.find((c) => c.key === v)?.label : k === 'coleccion' ? collections.find((c) => c.slug === v)?.name ?? v : String(v)}
                <span aria-hidden>×</span><span className="sr-only">Quitar filtro</span>
              </button>
            ))}
            <button className="text-sm underline underline-offset-4" onClick={() => setF({ categoria: f.categoria })}>Limpiar</button>
          </div>
        )}
      </div>

      {shown.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5 lg:grid-cols-4">
          {shown.map((p, i) => <li key={p.id}><ProductCard p={p} show3d={view3d} priority={i < 2} transferPct={transferPct} /></li>)}
        </ul>
      ) : (
        <div className="py-20 text-center">
          <p className="t-head text-3xl">No encontramos prendas con esos filtros</p>
          <button className="btn btn-ink mt-5" onClick={() => setF({})}>Ver todo el catálogo</button>
        </div>
      )}

      <AnimatePresence>
        {panel && (
          <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-night/55" onClick={() => setPanel(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Filtros"
              className="absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-3xl bg-chalk p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-3xl"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
              <div className="flex items-center justify-between">
                <h2 className="t-head text-2xl">Filtrar</h2>
                <button onClick={() => setPanel(false)} className="grid h-11 w-11 place-items-center" aria-label="Cerrar filtros">✕</button>
              </div>
              <Group title="Talle">
                {sizes.map((s) => <Chip key={s} on={f.talle === s} onClick={() => set({ talle: f.talle === s ? undefined : s })}>{s}{/^\d+$/.test(s) ? ' (niños)' : ''}</Chip>)}
              </Group>
              <Group title="Color">
                {colors.map((c) => (
                  <button key={c.key} onClick={() => set({ color: f.color === c.key ? undefined : c.key })} aria-pressed={f.color === c.key}
                    className={clsx('t-cond flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ring-1', f.color === c.key ? 'bg-ink text-white ring-ink' : 'bg-white ring-black/10')}>
                    <span className="h-6 w-6 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />{c.label}
                  </button>
                ))}
              </Group>
              <Group title="Precio">
                {prices.map((pr) => <Chip key={pr} on={f.precio === String(pr)} onClick={() => set({ precio: f.precio === String(pr) ? undefined : String(pr) })}>{money(pr)}</Chip>)}
              </Group>
              {collections.length > 0 && (
                <Group title="Colección">
                  {collections.map((c) => <Chip key={c.slug} on={f.coleccion === c.slug} onClick={() => set({ coleccion: f.coleccion === c.slug ? undefined : c.slug })}>{c.name}</Chip>)}
                </Group>
              )}
              <Group title="Ordenar">
                {(['destacados', 'nuevos', 'precio-asc', 'precio-desc'] as Sort[]).map((o) => (
                  <Chip key={o} on={(f.orden ?? 'destacados') === o} onClick={() => set({ orden: o })}>{{ destacados: 'Destacados', nuevos: 'Novedades', 'precio-asc': 'Menor precio', 'precio-desc': 'Mayor precio' }[o]}</Chip>
                ))}
              </Group>
              <div className="mt-6 flex gap-3">
                <button className="btn btn-ghost flex-1" onClick={() => setF({ categoria: f.categoria })}>Limpiar</button>
                <button className="btn btn-red flex-1" onClick={() => setPanel(false)}>Ver {list.length} {list.length === 1 ? 'prenda' : 'prendas'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={clsx('t-cond h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] ring-1 transition', on ? 'bg-ink text-white ring-ink' : 'bg-white ring-black/10 hover:ring-black/30')}>
      {children}
    </button>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="t-cond mb-2 text-mute">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
