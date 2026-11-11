/* eslint-disable @next/next/no-img-element */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import type { Story } from '@/lib/types';
import { pick } from '@/lib/format';
import { BMark } from '../Logo';

/** Historias destacadas como en su Instagram (Torneo BROX II, Remeras, Short…). */
export default function Stories({ stories }: { stories: Story[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!stories.length) return null;
  return (
    <>
      <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 py-1 md:mx-0 md:px-0" aria-label="Historias destacadas">
        {stories.map((s, i) => (
          <li key={s.id}>
            <button onClick={() => setOpen(i)} className="group flex w-[84px] flex-col items-center gap-2" aria-label={`Ver historia: ${s.title}`}>
              <span className="relative grid h-[78px] w-[78px] place-items-center rounded-full p-[3px]" style={{ background: 'conic-gradient(from 200deg, #fb2324, #ff8a3d, #fb2324 70%, #12151c)' }}>
                <span className="block h-full w-full overflow-hidden rounded-full border-[3px] border-chalk bg-night">
                  {s.cover ? <img src={pick(s.cover, 320)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <BMark className="m-auto h-8 w-8 text-white" />}
                </span>
              </span>
              <span className="t-cond line-clamp-1 text-sm">{s.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <AnimatePresence>{open !== null && <Viewer stories={stories} start={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}

function Viewer({ stories, start, onClose }: { stories: Story[]; start: number; onClose: () => void }) {
  const [si, setSi] = useState(start);
  const [ii, setIi] = useState(0);
  const [paused, setPaused] = useState(false);
  const story = stories[si];
  const item = story.items[ii];
  const vref = useRef<HTMLVideoElement>(null);
  const dur = item?.kind === 'video' ? Math.max(2, item.video?.duration ?? item.duration) : item?.duration ?? 5;
  const next = useCallback(() => {
    if (ii < story.items.length - 1) setIi(ii + 1);
    else if (si < stories.length - 1) { setSi(si + 1); setIi(0); }
    else onClose();
  }, [ii, si, story.items.length, stories.length, onClose]);
  const prev = () => {
    if (ii > 0) setIi(ii - 1);
    else if (si > 0) { setSi(si - 1); setIi(stories[si - 1].items.length - 1); }
  };
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(next, dur * 1000);
    return () => clearTimeout(t);
  }, [si, ii, paused, dur, next]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  });
  if (!item) return null;
  return (
    <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-night/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={`Historia ${story.title}`}>
      <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-black md:h-[92svh] md:rounded-3xl"
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)}>
        {item.kind === 'video' && item.video ? (
          <video key={item.id} ref={vref} autoPlay muted playsInline loop className="absolute inset-0 h-full w-full object-cover" poster={item.video.poster ? pick(item.video.poster, 720) : undefined}>
            {item.video.sources.v_webm && <source src={item.video.sources.v_webm} type="video/webm" />}
            {item.video.sources.v_mp4 && <source src={item.video.sources.v_mp4} type="video/mp4" />}
          </video>
        ) : item.image ? (
          <img key={item.id} src={pick(item.image, 960)} alt={item.caption ?? story.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pb-10">
          <div className="flex gap-1">
            {story.items.map((it, k) => (
              <span key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full origin-left bg-white" style={k < ii ? { transform: 'scaleX(1)' } : k === ii ? { animation: `storyprogress ${dur}s linear forwards`, animationPlayState: paused ? 'paused' : 'running' } : { transform: 'scaleX(0)' }} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-white">
            <BMark className="h-6 w-6 rounded-full bg-brand p-1 text-white" />
            <span className="font-semibold">broxpadel</span>
            <span className="text-white/60">· {story.title}</span>
            <button onClick={onClose} className="ml-auto grid h-10 w-10 place-items-center text-xl" aria-label="Cerrar historia">✕</button>
          </div>
        </div>
        <button className="absolute bottom-24 left-0 top-20 w-1/3" aria-label="Anterior" onClick={prev} />
        <button className="absolute bottom-24 right-0 top-20 w-2/3" aria-label="Siguiente" onClick={next} />
        {(item.caption || item.linkHref) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white">
            {item.caption && <p className="t-head text-2xl">{item.caption}</p>}
            {item.linkHref && <Link href={item.linkHref} onClick={onClose} className="btn btn-chalk mt-3">{item.linkLabel ?? 'Ver'}</Link>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
