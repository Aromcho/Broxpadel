'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import clsx from 'clsx';
import { View, Environment, ContactShadows } from '@react-three/drei';
import type { Product } from '@/lib/types';
import { money } from '@/lib/format';
import { useInView } from '@/lib/hooks';
import Pic from '../Pic';
import Reel from '../Reel';
import Garment from '@/three/garment/Garment';

/**
 * Tarjeta de producto. Al pasar el mouse: el video de la prenda en la cancha si tiene; si no, la prenda girando en 3D.
 * Con “Vista 3D” prendida, todas las prendas giran en 3D (en el lienzo compartido del catálogo).
 */
export default function ProductCard({ p, show3d, priority, transferPct = 0, onNeed3d }: { p: Product; show3d?: boolean; priority?: boolean; transferPct?: number; onNeed3d?: () => void }) {
  const [hover, setHover] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '100px' });
  const [loaded, setLoaded] = useState(false);
  const video = p.reels[0]?.video;
  const playVideo = !!video && hover && !show3d;
  const can3d = !!p.model && (!!show3d || !!onNeed3d);          // fuera del catálogo no hay lienzo 3D: ahí va la otra foto
  const active = can3d && inView && (show3d || (hover && !video));
  const front = p.images.find((i) => i.role === 'front') ?? p.images[0];
  const second = p.images.find((i) => i.role === 'back') ?? p.images[1];
  const lowStock = p.inStock && p.totalStock > 0 && p.totalStock <= 3;
  return (
    <article className="group relative" onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; setHover(true); if (!video && p.model) onNeed3d?.(); }} onPointerLeave={() => setHover(false)}>
      <Link href={`/producto/${p.slug}`} className="block focus-visible:outline-offset-4" aria-label={`${p.name}, ${money(p.price)}`}>
        <div ref={ref} className="tile relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-chalk-2">
          <Pic img={front} sizes="(min-width: 1024px) 25vw, 50vw" className={clsx('absolute inset-0 transition-opacity duration-500', active && loaded && 'opacity-0')} priority={priority} />
          {!video && !can3d && second && (
            <Pic img={second} sizes="(min-width: 1024px) 25vw, 50vw" className="absolute inset-0 opacity-0 transition-opacity duration-500 [@media(hover:hover)]:group-hover:opacity-100" />
          )}
          {playVideo && <Reel video={video} crop="v" rounded={false} className="absolute inset-0" label={p.name} />}
          {active && (
            <View className={clsx('absolute inset-0 transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}>
              <color attach="background" args={['#ebe9e3']} />
              <ambientLight intensity={0.5} />
              <directionalLight position={[1.5, 2, 2]} intensity={1.4} />
              <Suspense fallback={null}>
                <Environment files="/hdri/studio_small_03_1k.hdr" environmentIntensity={0.75} />
                <group scale={p.garment === 'tee' ? 1.25 : 1.6} position={[0, 0.04, 0]}>
                  <Garment url={p.model!.glb} spin={0.55} onLoaded={() => setLoaded(true)} />
                </group>
                <ContactShadows position={[0, -0.52, 0]} opacity={0.35} scale={2} blur={2.5} far={1} />
              </Suspense>
            </View>
          )}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {p.isNew && <span className="tag bg-ink text-white"><span>Nuevo</span></span>}
            {!p.inStock && <span className="tag bg-white text-ink"><span>Sin stock</span></span>}
            {lowStock && <span className="tag bg-ball text-ink"><span>Últimas unidades</span></span>}
          </div>
          <div className="absolute bottom-3 right-3 flex gap-1.5" aria-hidden>
            {video && (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-ink backdrop-blur" title="Tiene video">
                <svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
              </span>
            )}
            {p.model && <span className="t-num grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[11px] font-bold text-ink backdrop-blur" title="Se puede ver en 3D">3D</span>}
          </div>
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
