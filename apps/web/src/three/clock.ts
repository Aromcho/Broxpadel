'use client';

/**
 * Reloj compartido de las escenas 3D.
 * Modo normal: avanza con requestAnimationFrame.
 * Modo captura (?capture=1): lo maneja el grabador con window.__setTime(seg) → cuadro a cuadro, determinístico.
 */
type Listener = () => Promise<void> | void;
export const clock = {
  capture: false,
  time: 0,
  /** progreso del scroll de la cancha (0..1) */
  court: 0,
  /** quien pinta un cuadro cuando cambia el tiempo en modo captura */
  renderers: new Set<() => void>(),
  /** tareas a esperar antes de dar el cuadro por listo (p. ej. videos haciendo seek) */
  waiters: new Set<Listener>(),
};

export function isCapture() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('capture');
}

declare global {
  interface Window {
    __setTime?: (t: number) => Promise<void>;
    __captureReady?: boolean;
  }
}

export function installCaptureClock() {
  if (typeof window === 'undefined' || window.__setTime) return;
  clock.capture = isCapture();
  if (!clock.capture) return;
  document.documentElement.dataset.capture = '1';
  window.__setTime = async (t: number) => {
    clock.time = t;
    await Promise.all([...clock.waiters].map((w) => w()));
    clock.renderers.forEach((r) => r());
    // dos frames: uno para que R3F pinte, otro para que el compositor lo muestre
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  };
}
