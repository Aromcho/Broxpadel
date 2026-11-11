'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import clsx from 'clsx';
import { View, Environment, ContactShadows } from '@react-three/drei';
import type { Product } from '@/lib/types';
import { money } from '@/lib/format';
import { useInView } from '@/lib/hooks';
import Pic from '../Pic';
import Garment from '@/three/garment/Garment';

/** Tarjeta de producto. Con “Vista 3D” (o al pasar el mouse) la prenda gira en el canvas compartido. */
export default function ProductCard({ p, show3d, priority, transferPct = 0 }: { p: Product; show3d?: boolean; priority?: boolean; transferPct?: number }) {
  const [hover, setHover] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '100px' });
  const [loaded, setLoaded] = useState(false);
  const active = !!p.model && inView && (show3d || hover);
  const front = p.images.find((i) => i.role === 'front') ?? p.images[0];
  const second = p.images.find((i) => i.role === 'back') ?? p.images[1];
  const lowStock = p.inStock && p.totalStock > 0 && p.totalStock <= 3;
  return (
    <article className="group relative" onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)} onPointerLeave={() => setHover(false)}>
      <Link href={`/producto/${p.slug}`} className="block focus-visible:outline-offset-4" aria-label={`${p.name}, ${money(p.price)}`}>
        <div ref={ref} className="tile relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-chalk-2">
          <Pic img={front} sizes="(min-width: 1024px) 25vw, 50vw" className={clsx('absolute inset-0 transition-opacity duration-500', active && loaded && 'opacity-0')} priority={priority} />
          {second && !show3d && (
            <Pic img={second} sizes="(min-width: 1024px) 25vw, 50vw" className="absolute inset-0 opacity-0 transition-opacity duration-500 [@media(hover:hover)]:group-hover:opacity-100" />
          )}
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
          {p.model && (
            <span className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[11px] font-bold text-ink backdrop-blur t-num" aria-hidden>3D</span>
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
