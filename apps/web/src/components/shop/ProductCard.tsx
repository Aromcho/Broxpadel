'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { money } from '@/lib/format';
import Pic from '../Pic';
import Reel from '../Reel';

/** Tarjeta de producto. Al pasar el mouse muestra el video de la prenda en la cancha (si tiene) o la otra foto. */
export default function ProductCard({ p, priority, transferPct = 0 }: { p: Product; priority?: boolean; transferPct?: number }) {
  const [hover, setHover] = useState(false);
  const front = p.images.find((i) => i.role === 'front') ?? p.images[0];
  const second = p.images.find((i) => i.role === 'back') ?? p.images[1];
  const video = p.reels[0]?.video;
  const lowStock = p.inStock && p.totalStock > 0 && p.totalStock <= 3;
  return (
    <article className="group relative" onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)} onPointerLeave={() => setHover(false)}>
      <Link href={`/producto/${p.slug}`} className="block focus-visible:outline-offset-4" aria-label={`${p.name}, ${money(p.price)}`}>
        <div className="tile relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-chalk-2">
          <Pic img={front} sizes="(min-width: 1024px) 25vw, 50vw" className="absolute inset-0" priority={priority} />
          {!video && second && (
            <Pic img={second} sizes="(min-width: 1024px) 25vw, 50vw" className="absolute inset-0 opacity-0 transition-opacity duration-500 [@media(hover:hover)]:group-hover:opacity-100" />
          )}
          {video && hover && <Reel video={video} crop="v" rounded={false} className="absolute inset-0" label={p.name} />}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {p.isNew && <span className="tag bg-ink text-white"><span>Nuevo</span></span>}
            {!p.inStock && <span className="tag bg-white text-ink"><span>Sin stock</span></span>}
            {lowStock && <span className="tag bg-ball text-ink"><span>Últimas unidades</span></span>}
          </div>
          {video && (
            <span className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-ink backdrop-blur" aria-hidden title="Tiene video">
              <svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{p.name}</h3>
            <p className="t-cond mt-0.5 text-sm text-mute">{p.sizes.length > 1 ? `${p.sizes.filter((s) => !/^\d+$/.test(s)).slice(0, 1)[0] ?? p.sizes[0]} a ${p.sizes.filter((s) => !/^\d+$/.test(s)).slice(-1)[0] ?? p.sizes.slice(-1)[0]}` : 'Talle único'}</p>
          </div>
          <div className="text-right">
            <p className="t-num text-lg leading-tight">{money(p.price)}</p>
            {transferPct > 0 && <p className="t-cond text-xs text-mute">{money(p.price * (1 - transferPct / 100))} transf.</p>}
          </div>
        </div>
      </Link>
    </article>
  );
}
