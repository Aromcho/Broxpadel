'use client';
import { createElement, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/** “Ver en AR”: <model-viewer> con GLB (Android, WebXR) y USDZ (iPhone, Quick Look). Se carga recién al tocar. */
export default function ARButton({ glb, usdz, name, poster }: { glb: string; usdz: string | null; name: string; poster?: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const mv = useRef<HTMLElement & { canActivateAR?: boolean; activateAR?: () => void }>(null);
  useEffect(() => {
    if (!open) return;
    import('@google/model-viewer').then((m) => {
      const MV = (m as unknown as { ModelViewerElement: { meshoptDecoderLocation: string } }).ModelViewerElement;
      MV.meshoptDecoderLocation = '/vendor/meshopt_decoder.js';
      setReady(true);
    });
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="t-cond flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm ring-1 ring-black/10 hover:ring-black/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>
        Ver en tu espacio (AR)
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] flex flex-col bg-chalk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={`${name} en realidad aumentada`}>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="t-head text-xl">{name}</p>
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center text-xl" aria-label="Cerrar">✕</button>
            </div>
            <div className="relative flex-1">
              {ready &&
                createElement('model-viewer', {
                  ref: mv, src: glb, 'ios-src': usdz ?? undefined, poster, alt: `${name} en 3D`, ar: true, 'ar-modes': 'webxr scene-viewer quick-look',
                  'camera-controls': true, 'auto-rotate': true, 'shadow-intensity': '0.8', exposure: '1', 'environment-image': 'neutral', 'touch-action': 'pan-y',
                  style: { width: '100%', height: '100%', background: '#f3f2ee' },
                }, createElement('button', { slot: 'ar-button', className: 'btn btn-red absolute bottom-6 left-1/2 -translate-x-1/2' }, 'Ponerla en tu espacio'))}
            </div>
            <p className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-mute">Funciona en celulares con AR (iPhone con Quick Look, Android con ARCore). En la compu podés girarla con el mouse.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
