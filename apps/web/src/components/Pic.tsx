/* eslint-disable @next/next/no-img-element */
'use client';
import { useCallback, useState } from 'react';
import clsx from 'clsx';
import type { Img } from '@/lib/types';
import { pick, srcSet } from '@/lib/format';

/** Imagen WebP responsive con placeholder borroso (generado con sharp en el servidor). */
export default function Pic({ img, sizes = '100vw', className, imgClassName, alt, priority, fit = 'cover', position }: {
  img: Img | null | undefined; sizes?: string; className?: string; imgClassName?: string; alt?: string; priority?: boolean; fit?: 'cover' | 'contain'; position?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  // si la imagen ya estaba en caché, onLoad pudo dispararse antes de hidratar: lo chequeamos al montar
  const ref = useCallback((el: HTMLImageElement | null) => { if (el?.complete && el.naturalWidth) setLoaded(true); }, []);
  if (!img) return <div className={clsx('bg-chalk-2', className)} />;
  return (
    <div className={clsx(!className?.includes('absolute') && 'relative', 'overflow-hidden', className)} style={{ backgroundColor: img.dominant ?? undefined }}>
      {img.blur && !loaded && (
        <img src={img.blur} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" style={{ objectPosition: position }} />
      )}
      <img
        src={pick(img, 960)}
        srcSet={srcSet(img)}
        sizes={sizes}
        alt={alt ?? img.alt ?? ''}
        width={img.w}
        height={img.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        ref={ref}
        onLoad={() => setLoaded(true)}
        className={clsx('relative h-full w-full transition-opacity duration-500', fit === 'cover' ? 'object-cover' : 'object-contain', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
        style={{ objectPosition: position }}
      />
    </div>
  );
}
