import Link from 'next/link';
import type { Banner, Business, Collection, Product } from '@/lib/types';
import { money } from '@/lib/format';
import Reel from '../Reel';
import Pic from '../Pic';

export function SectionTitle({ kicker, title, children, id, dark }: { kicker: string; title: string; children?: React.ReactNode; id?: string; dark?: boolean }) {
  return (
    <div id={id} className="mb-6 flex scroll-mt-24 flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        <p className={`t-cond flex items-center gap-2 ${dark ? 'text-white/60' : 'text-mute'}`}><span className="speed text-brand"><i /><i /><i /></span>{kicker}</p>
        <h2 className="t-head mt-2 max-w-[18ch] text-[clamp(2.1rem,6vw,3.8rem)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Colecciones con video real de fondo. */
export function Collections({ collections }: { collections: Collection[] }) {
  const list = collections.filter((c) => c.featured);
  if (!list.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((c, i) => (
        <Link key={c.slug} href={`/catalogo?coleccion=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-night text-white md:aspect-[5/6]">
          {c.video ? <Reel video={c.video} crop="v" rounded={false} className="absolute inset-0" label={c.name} /> : <Pic img={c.cover} className="absolute inset-0" />}
          <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            {c.kicker && <p className="t-cond text-white/75">{c.kicker}</p>}
            <h3 className="t-head mt-1 text-[clamp(2rem,5vw,3.2rem)]">{c.name}</h3>
            {c.description && <p className="mt-2 max-w-[38ch] text-white/80">{c.description}</p>}
            <span className="btn btn-chalk mt-5">{i === 0 ? 'Ver lo nuevo' : 'Ver conjuntos'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** “En la cancha”: los reels reales, cada uno con la prenda que se ve. */
export function OnCourt({ products }: { products: Product[] }) {
  const items = products.flatMap((p) => p.reels.map((r) => ({ p, r }))).filter((x) => x.r.video);
  if (!items.length) return null;
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
      {items.map(({ p, r }) => (
        <li key={r.id} className="w-[64vw] shrink-0 snap-start sm:w-[42vw] md:w-auto">
          <Link href={`/producto/${p.slug}`} className="group block">
            <Reel video={r.video} crop="v" className="aspect-[9/16]" label={`${r.caption ?? p.name}`} />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="t-cond text-sm text-white/60">{r.caption}</p>
              </div>
              <span className="t-num">{money(p.price)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PromoBanners({ banners }: { banners: Banner[] }) {
  const list = banners.filter((b) => b.placement === 'promo');
  if (!list.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((b) => (
        <div key={b.id} className="relative overflow-hidden rounded-[var(--radius-tile)] bg-night text-white">
          {b.video && <Reel video={b.video} crop="h" rounded={false} className="absolute inset-0 opacity-70" label={b.title} />}
          {!b.video && b.image && <Pic img={b.image} className="absolute inset-0 opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-r from-night/90 via-night/55 to-transparent" />
          <div className="relative flex min-h-[300px] flex-col justify-end p-6 md:min-h-[360px] md:p-8">
            {b.kicker && <p className="t-cond text-ball">{b.kicker}</p>}
            <h3 className="t-head mt-1 max-w-[16ch] text-[clamp(1.8rem,4.5vw,2.8rem)]">{b.title}</h3>
            {b.subtitle && <p className="mt-2 max-w-[42ch] text-white/80">{b.subtitle}</p>}
            {b.ctaHref && <Link href={b.ctaHref} className="btn btn-chalk mt-5 self-start">{b.ctaLabel ?? 'Ver más'}</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoStrip({ business }: { business: Business }) {
  const items = [
    { t: business.shippingText ?? 'Envíos a todo el país', d: 'Despachamos desde Villa Gesell. El costo se coordina según tu código postal.' },
    business.transferDiscountPct > 0 && { t: `${business.transferDiscountPct}% off con transferencia`, d: 'El descuento se aplica sobre los productos al elegir transferencia.' },
    { t: 'Mercado Pago', d: business.installmentsText ? `${business.installmentsText}, billetera y dinero en cuenta.` : 'Tarjetas, billetera y dinero en cuenta.' },
    { t: 'Comprá por WhatsApp', d: 'Armá el carrito y mandanos el pedido listo: te respondemos por chat.' },
  ].filter(Boolean) as { t: string; d: string }[];
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-tile)] bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <li key={i.t} className="bg-chalk p-6">
          <p className="t-head text-xl">{i.t}</p>
          <p className="mt-2 text-mute">{i.d}</p>
        </li>
      ))}
    </ul>
  );
}
