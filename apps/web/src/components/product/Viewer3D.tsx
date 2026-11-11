'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import type { OrbitControls as OC } from 'three-stdlib';
import Garment from '@/three/garment/Garment';
import { clock } from '@/three/clock';
import { useInView, isLowEnd } from '@/lib/hooks';

function Rig({ url, garment, onLoaded }: { url: string; garment: string; onLoaded: () => void }) {
  const ctl = useRef<OC>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    if (!clock.capture) return;
    const r = () => invalidate();
    clock.renderers.add(r);
    return () => { clock.renderers.delete(r); };
  }, [invalidate]);
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[1.6, 2.2, 2]} intensity={1.6} />
      <directionalLight position={[-2, 1, -1.5]} intensity={0.5} color="#dfe8ff" />
      <Environment files="/hdri/studio_small_03_1k.hdr" environmentIntensity={0.85} />
      <group scale={garment === 'tee' ? 1 : 1.25}>
        <Garment url={url} onLoaded={onLoaded} spin={clock.capture ? 0.6 : 0} />
      </group>
      <ContactShadows position={[0, -0.42, 0]} opacity={0.42} scale={2.2} blur={2.4} far={1} resolution={512} />
      <OrbitControls
        ref={ctl}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!clock.capture}
        autoRotateSpeed={1.1}
        minDistance={0.75}
        maxDistance={1.7}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.62}
        target={[0, 0, 0]}
      />
    </>
  );
}

/** Visor 3D de la prenda: arrastrar para girar, autorrotación suave, zoom limitado. Póster mientras carga. */
export default function Viewer3D({ url, poster, garment, label }: { url: string; poster?: string; garment: string; label: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '0px' });
  const [loaded, setLoaded] = useState(false);
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);
  useEffect(() => { setLoaded(false); }, [url]);
  useEffect(() => { if (isLowEnd()) setDpr([0.75, 1.25]); }, []);
  return (
    <div ref={ref} className="relative h-full w-full touch-pan-y" role="img" aria-label={`Vista 3D de ${label}. Arrastrá para girarla.`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {poster && <img src={poster} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-contain p-6 transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`} />}
      {!loaded && <span className="t-cond absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-sm">Cargando 3D…</span>}
      <Canvas
        frameloop={clock.capture ? 'demand' : inView ? 'always' : 'never'}
        dpr={dpr}
        camera={{ position: [0.35, 0.08, 1.2], fov: 38 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: clock.capture }}
        className={`!absolute inset-0 transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      >
        <PerformanceMonitor onDecline={() => setDpr([0.75, 1.25])} />
        <AdaptiveDpr pixelated={false} />
        <Suspense fallback={null}>
          <Rig url={url} garment={garment} onLoaded={() => setLoaded(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
