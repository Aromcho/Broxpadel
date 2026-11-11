'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Video } from '@/lib/types';
import { pick } from '@/lib/format';
import { Logo } from '@/components/Logo';

type Feature = { kicker: string; title: string; body: string };

/** Portada: los videos de la cancha de @broxpadel de fondo, uno detrás de otro, con el logo encima. */
export default function HeroVideos({ videos, features }: { videos: Video[]; features: Feature[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mobile, setMobile] = useState(false);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const n = videos.length;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setMobile(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // reproduce el video activo desde el principio; los demás quedan en pausa
  useEffect(() => {
    refs.current.forEach((v, i) => {
      if (!v) return;
      if (i === idx && !paused) { v.currentTime = 0; v.play().catch(() => undefined); }
      else if (i !== idx) v.pause();
    });
    if (paused) refs.current[idx]?.pause();
    // por si un video no arranca (ahorro de datos, error), pasa al siguiente igual
    const t = !paused && n > 1 ? setTimeout(() => setIdx((i) => (i + 1) % n), 9000) : undefined;
    return () => clearTimeout(t);
  }, [idx, paused, n, mobile]);

  const src = (v: Video) => {
    const s = v.sources;
    return mobile ? { webm: s.v_webm ?? s.webm_720, mp4: s.v_mp4 ?? s.mp4_720 } : { webm: s.h_webm ?? s.webm_1080 ?? s.webm_720, mp4: s.h_mp4 ?? s.mp4_1080 ?? s.mp4_720 };
  };

  return (
    <>
      <section data-court className="relative -mt-14 h-svh min-h-[560px] overflow-hidden bg-night text-white md:-mt-16" aria-label="Brox Padel">
        {videos.map((v, i) => {
          const near = i === idx || i === (idx + 1) % n;     // solo carga el actual y el que sigue
          const { webm, mp4 } = src(v);
          return (
            <div key={v.id} className={clsx('absolute inset-0 transition-opacity duration-700', i === idx ? 'opacity-100' : 'opacity-0')} aria-hidden={i !== idx}>
              {v.poster && <img src={pick(v.poster, mobile ? 720 : 1280)} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} />}
              {near && (
                <video key={`${v.id}-${mobile ? 'm' : 'd'}`} ref={(el) => { refs.current[i] = el; }} muted playsInline preload="auto" onEnded={() => setIdx((k) => (k + 1) % n)}
                  className="absolute inset-0 h-full w-full object-cover" aria-label={v.title ?? 'Video de la cancha'}>
                  {webm && <source src={webm} type='video/webm; codecs="vp9"' />}
                  {mp4 && <source src={mp4} type="video/mp4" />}
                </video>
              )}
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,12,.55)_0%,rgba(5,7,12,.25)_38%,rgba(5,7,12,.35)_62%,rgba(5,7,12,.9)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_42%_at_50%_42%,rgba(5,7,12,.55),transparent_80%)]" />

        <div className="absolute inset-x-0 top-[22svh] px-5 text-center md:top-[24svh]">
          <h1 className="sr-only">Brox Padel · Indumentaria de pádel</h1>
          <Logo className="mx-auto h-auto w-[min(80vw,580px)] drop-shadow-[0_6px_30px_rgba(0,0,0,.55)]" />
          <p className="t-head mx-auto mt-6 max-w-[22ch] text-[clamp(1.5rem,5.4vw,2.4rem)] [text-shadow:0_2px_18px_rgba(0,0,0,.6)]">Ropa que rinde como vos.</p>
          <p className="mx-auto mt-3 max-w-[38ch] text-white/85 [text-shadow:0_1px_12px_rgba(0,0,0,.8)]">Remeras y shorts de pádel con tecnología Dry-Wick y UPF 50+.</p>
          <a href="#catalogo" className="btn btn-red mt-7">Ver la colección</a>
        </div>

        {n > 1 && (
          <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-4 px-5">
            <div className="flex gap-1.5" aria-hidden>
              {videos.map((v, i) => <span key={v.id} className={clsx('h-[3px] rounded-full transition-all duration-500', i === idx ? 'w-8 bg-brand' : 'w-4 bg-white/40')} />)}
            </div>
            <button type="button" onClick={() => setPaused((p) => !p)} className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur" aria-label={paused ? 'Reproducir los videos' : 'Pausar los videos'}>
              {paused
                ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor" /></svg>}
            </button>
          </div>
        )}
      </section>

      <section className="bg-night text-white" aria-label="Por qué BROX">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title}>
              <p className="t-cond flex items-center gap-2 text-ball"><span className="speed text-brand"><i /><i /><i /></span>{f.kicker}</p>
              <h2 className="t-head mt-2 text-[1.7rem] leading-tight">{f.title}</h2>
              <p className="mt-2 text-white/75">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
