'use client';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { Video } from '@/lib/types';
import { pick } from '@/lib/format';
import { useInView, useReducedMotion } from '@/lib/hooks';

/** Video real de su IG: siempre mudo, playsinline, carga diferida y en pausa fuera de pantalla. */
export default function Reel({ video, crop = 'v', className, rounded = true, label }: { video: Video; crop?: 'v' | 'h' | 'full'; className?: string; rounded?: boolean; label?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '150px' });
  const vref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const s = video.sources;
  const mp4 = crop === 'v' ? s.v_mp4 : crop === 'h' ? s.h_mp4 : s.mp4_1080 ?? s.mp4_720;
  const webm = crop === 'v' ? s.v_webm : crop === 'h' ? s.h_webm : s.webm_1080 ?? s.webm_720;
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (inView && !reduced) v.play().catch(() => undefined);
    else v.pause();
  }, [inView, reduced]);
  return (
    <div ref={ref} className={clsx(!className?.includes('absolute') && 'relative', 'overflow-hidden bg-night', rounded && 'rounded-[var(--radius-tile)]', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {video.poster && <img src={pick(video.poster, 720)} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />}
      {inView && (
        <video ref={vref} muted loop playsInline preload="metadata" poster={video.poster ? pick(video.poster, 720) : undefined} aria-label={label ?? video.title ?? 'Video de Brox Padel'}
          className="absolute inset-0 h-full w-full object-cover">
          {webm && <source src={webm} type='video/webm; codecs="vp9"' />}
          {mp4 && <source src={mp4} type="video/mp4" />}
        </video>
      )}
    </div>
  );
}
