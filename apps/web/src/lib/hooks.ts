'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export function useInView<T extends Element>(opts: IntersectionObserverInit = { rootMargin: '200px' }) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), opts);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView] as const;
}

const subscribeRM = (cb: () => void) => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
export function useReducedMotion() {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
}

/** Celulares flojos: pocos núcleos / poca memoria / ahorro de datos. */
export function isLowEnd() {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  if (n.connection?.saveData) return true;
  if (n.connection?.effectiveType && /(^|-)2g/.test(n.connection.effectiveType)) return true;
  return (n.hardwareConcurrency ?? 8) <= 4 && (n.deviceMemory ?? 8) <= 3;
}

export function useHydrated() {
  return useSyncExternalStore(() => () => undefined, () => true, () => false);
}
