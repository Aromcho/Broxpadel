'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { installCaptureClock, isCapture } from '@/three/clock';

gsap.registerPlugin(ScrollTrigger);

/** Lenis (solo rueda/trackpad: el dedo usa el scroll nativo) sincronizado con ScrollTrigger. */
export default function SmoothScroll() {
  useEffect(() => {
    installCaptureClock();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || isCapture()) return;
    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1, syncTouch: false, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
