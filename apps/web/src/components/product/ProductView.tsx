'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import type { Business, Product } from '@/lib/types';
import { money, pick } from '@/lib/format';
import { useCart } from '@/lib/cart';
import Pic from '../Pic';
import Reel from '../Reel';
import ARButton from './ARButton';

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false });
const isKid = (s: string) => /^\d+$/.test(s);

export default function ProductView({ initial, family, business }: { initial: Product; family: Product[]; business: Pick<Business, 'whatsapp' | 'transferDiscountPct' | 'shippingText' | 'installmentsText'> }) {
  const [p, setP] = useState(initial);
  const [tab, setTab] = useState<'fotos' | '3d'>(initial.model ? '3d' : 'fotos');
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useCart((s) => s.add);
  const variant = p.variants.find((v) => v.size === size) ?? null;
  const single = p.variants.length === 1;

  useEffect(() => { if (single) setSize(p.variants[0].size); }, [p, single]);
  const swap = (np: Product) => {
    setP(np); setSize(null); setQty(1); setSlide(0); setError(null);
    window.history.replaceState(null, '', `/producto/${np.slug}`);
    document.title = `${np.name} · Brox Padel`;
  };
  const front = p.images.find((i) => i.role === 'front') ?? p.images[0];
  const priceNow = variant?.price ?? p.price;
  const wa = business.whatsapp
    ? `https://wa.me/${business.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Hola Brox! Quiero la ${p.name}${size ? ` en talle ${size}` : ''} (${money(priceNow)}). ¿Hay stock?`)}`
    : null;

  const addToCart = () => {
    if (!variant) { setError('Elegí tu talle'); return; }
    if (!variant.available) { setError('Ese talle está sin stock'); return; }
    add({ variantId: variant.id, productId: p.id, slug: p.slug, name: p.name, size: variant.size, color: p.colorName, price: variant.price, image: pick(front, 320), max: variant.stock }, qty);
  };
  const sizes = useMemo(() => p.variants, [p]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 md:px-6 md:pt-8">
      <nav className="t-cond mb-4 text-sm text-mute" aria-label="Ruta">
        <Link href="/" className="hover:underline">Inicio</Link> <span aria-hidden>/</span>{' '}
        <Link href="/catalogo" className="hover:underline">Catálogo</Link>
        {p.category && <> <span aria-hidden>/</span> <Link href={`/catalogo?categoria=${p.category.slug}`} className="hover:underline">{p.category.name}</Link></>}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        {/* medios */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {p.model && (
            <div className="mb-3 inline-flex rounded-full bg-white p-1 ring-1 ring-black/10" role="tablist" aria-label="Vista">
              {(['3d', 'fotos'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx('t-cond h-9 rounded-full px-4 text-sm transition', tab === t ? 'bg-ink text-white' : '')}>{t === '3d' ? 'Girar en 3D' : `Fotos (${p.images.length})`}</button>
              ))}
            </div>
          )}
          <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-[#ebe9e3] md:aspect-square">
            {tab === '3d' && p.model ? (
              <Viewer3D url={p.model.glb} poster={pick(front, 960)} garment={p.garment} label={p.name} />
            ) : (
              <>
                <div className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                  {p.images.map((im, i) => (
                    <Pic key={im.id} img={im} className="h-full w-full shrink-0 snap-center" sizes="(min-width:1024px) 55vw, 100vw" priority={i === 0} alt={im.alt ?? p.name} />
                  ))}
                </div>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {p.images.map((im, i) => <span key={im.id} className={clsx('h-1.5 rounded-full bg-white transition-all', slide === i ? 'w-5' : 'w-1.5 opacity-60')} />)}
                </div>
              </>
            )}
          </div>
          {tab === 'fotos' && (
            <div className="no-scrollbar mt-3 hidden gap-2 overflow-x-auto md:flex">
              {p.images.map((im, i) => (
                <button key={im.id} aria-label={`Foto ${i + 1}`} className={clsx('h-20 w-16 shrink-0 overflow-hidden rounded-lg ring-2', slide === i ? 'ring-ink' : 'ring-transparent')}
                  onClick={(e) => { const sc = (e.currentTarget.parentElement!.previousElementSibling as HTMLElement).querySelector('.snap-x') as HTMLElement; sc?.scrollTo({ left: sc.clientWidth * i, behavior: 'smooth' }); setSlide(i); }}>
                  <Pic img={im} className="h-full w-full" sizes="80px" />
                </button>
              ))}
            </div>
          )}
          {p.model && <div className="mt-3 flex flex-wrap items-center gap-3"><ARButton glb={p.model.glb} usdz={p.model.usdz} name={p.name} poster={pick(front, 720)} />{tab === '3d' && <span className="t-cond text-sm text-mute">Arrastrá para girarla · pellizcá para acercar</span>}</div>}
        </div>

        {/* info */}
        <div>
          <div className="flex flex-wrap gap-2">
            {p.isNew && <span className="tag bg-ink text-white"><span>Nuevo</span></span>}
            {p.category && <span className="tag bg-white text-ink ring-1 ring-black/10"><span>{p.category.name}</span></span>}
          </div>
          <h1 className="t-head mt-3 text-[clamp(2.2rem,6vw,3.6rem)]">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="t-num text-3xl">{money(priceNow)}</p>
            {business.transferDiscountPct > 0 && <p className="text-mute"><span className="t-num text-ink">{money(priceNow * (1 - business.transferDiscountPct / 100))}</span> con transferencia</p>}
          </div>
          {business.installmentsText && <p className="mt-1 text-sm text-mute">{business.installmentsText} con Mercado Pago</p>}

          {family.length > 1 && (
            <fieldset className="mt-6">
              <legend className="t-cond text-mute">Color: <span className="text-ink">{p.colorName}</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {family.map((f) => (
                  <button key={f.id} onClick={() => swap(f)} aria-pressed={f.id === p.id} aria-label={f.colorName ?? f.name} title={f.colorName ?? f.name}
                    className={clsx('relative h-11 w-11 rounded-full ring-2 ring-offset-2 ring-offset-chalk transition', f.id === p.id ? 'ring-ink' : 'ring-transparent hover:ring-black/25')}>
                    <span className="absolute inset-0 rounded-full ring-1 ring-black/15" style={{ background: f.colorHex2 ? `linear-gradient(180deg, ${f.colorHex} 45%, ${f.colorHex2})` : f.colorHex ?? '#ccc' }} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-6">
            <div className="flex items-center justify-between">
              <legend className="t-cond text-mute">Talle{size ? <>: <span className="text-ink">{size}</span></> : ''}</legend>
              {p.sizeGuide && <button className="text-sm underline underline-offset-4" onClick={() => setGuide(true)}>Guía de talles</button>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((v) => (
                <button key={v.id} disabled={!v.available} onClick={() => { setSize(v.size); setError(null); setQty(1); }} aria-pressed={size === v.size}
                  className={clsx('t-cond relative h-12 min-w-12 rounded-xl px-3 text-[15px] ring-1 transition', size === v.size ? 'bg-ink text-white ring-ink' : 'bg-white ring-black/15 hover:ring-black/40', !v.available && 'cursor-not-allowed text-black/30 line-through')}>
                  {v.size}{isKid(v.size) && <span className="ml-1 text-xs opacity-70">niños</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-5 text-sm" aria-live="polite">
              {error ? <span className="text-turf">{error}</span> : variant ? (variant.available ? (variant.stock <= variant.lowStock ? <span className="text-turf">¡Quedan {variant.stock}!</span> : <span className="text-mute">En stock</span>) : <span className="text-mute">Sin stock en este talle</span>) : null}
            </p>
          </fieldset>

          <div className="mt-4 flex gap-3">
            <div className="flex h-12 items-center rounded-full bg-white ring-1 ring-black/15">
              <button className="grid h-12 w-11 place-items-center text-xl" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Restar uno">−</button>
              <span className="t-num w-6 text-center" aria-live="polite">{qty}</span>
              <button className="grid h-12 w-11 place-items-center text-xl" onClick={() => setQty(Math.min(variant?.stock ?? 9, qty + 1))} aria-label="Sumar uno">+</button>
            </div>
            <button className="btn btn-red flex-1" onClick={addToCart} disabled={!p.inStock}>{p.inStock ? 'Agregar al carrito' : 'Sin stock'}</button>
          </div>
          {wa && <a href={wa} target="_blank" rel="noopener" className="btn btn-ghost mt-3 w-full">Consultar por WhatsApp</a>}

          <ul className="mt-8 space-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-3"><span className="speed mt-1.5 text-brand"><i /><i /><i /></span><span>{f}</span></li>
            ))}
          </ul>
          {p.description && <p className="mt-6 max-w-[60ch] text-[17px] leading-relaxed text-ink/85">{p.description}</p>}
          <dl className="mt-8 divide-y divide-black/10 rounded-2xl bg-white ring-1 ring-black/10">
            <div className="flex gap-4 p-4"><dt className="t-cond w-24 shrink-0 text-mute">Envío</dt><dd>{business.shippingText ?? 'A todo el país'}. El costo se coordina según tu código postal.</dd></div>
            <div className="flex gap-4 p-4"><dt className="t-cond w-24 shrink-0 text-mute">Pago</dt><dd>Mercado Pago, transferencia{business.transferDiscountPct ? ` (${business.transferDiscountPct}% off)` : ''} o pedido por WhatsApp.</dd></div>
            <div className="flex gap-4 p-4"><dt className="t-cond w-24 shrink-0 text-mute">Cambios</dt><dd>Tenés 10 días para arrepentirte de la compra. <Link href="/arrepentimiento" className="underline underline-offset-4">Cómo hacerlo</Link></dd></div>
          </dl>
        </div>
      </div>

      {p.reels.length > 0 && (
        <section className="mt-16" aria-labelledby="accion">
          <h2 id="accion" className="t-head text-[clamp(2rem,5vw,3rem)]">En acción</h2>
          <p className="mt-1 text-mute">Así se ve en la cancha, en los videos de @broxpadel.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {p.reels.map((r) => (
              <figure key={r.id}>
                <Reel video={r.video} crop="v" className="aspect-[9/16]" label={r.caption ?? p.name} />
                <figcaption className="t-cond mt-2 text-sm text-mute">{r.caption} {r.igUrl && <a href={r.igUrl} target="_blank" rel="noopener" className="underline underline-offset-4">Ver en Instagram</a>}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {guide && p.sizeGuide && (
          <motion.div className="fixed inset-0 z-[80] grid place-items-end bg-night/55 md:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setGuide(false)}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="guia" onClick={(e) => e.stopPropagation()} initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
              className="w-full max-w-lg rounded-t-3xl bg-chalk p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-3xl">
              <div className="flex items-center justify-between"><h2 id="guia" className="t-head text-2xl">Guía de talles · {p.sizeGuide.name}</h2><button onClick={() => setGuide(false)} className="grid h-11 w-11 place-items-center" aria-label="Cerrar">✕</button></div>
              <table className="mt-4 w-full text-left">
                <thead><tr>{p.sizeGuide.columns.map((c) => <th key={c} className="t-cond border-b border-black/15 py-2 font-normal text-mute">{c}</th>)}</tr></thead>
                <tbody>{p.sizeGuide.rows.map((r) => <tr key={r[0]} className={clsx(size === r[0] && 'bg-ball/40')}>{r.map((c, i) => <td key={i} className={clsx('border-b border-black/10 py-2', i === 0 ? 'font-semibold' : 't-num')}>{c}</td>)}</tr>)}</tbody>
              </table>
              {p.sizeGuide.notes && <p className="mt-4 text-sm text-mute">{p.sizeGuide.notes}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
