'use client';
import { Canvas } from '@react-three/fiber';
import { View, Preload } from '@react-three/drei';
import { useEffect, useState } from 'react';

/** Un solo contexto WebGL para todas las tarjetas del catálogo (drei View). */
export default function CatalogCanvas() {
  const [src, setSrc] = useState<HTMLElement | null>(null);
  useEffect(() => setSrc(document.body), []);
  if (!src) return null;
  return (
    <Canvas
      eventSource={src}
      className="!pointer-events-none !fixed !inset-0 z-[5]"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1.6], fov: 35 }}
      frameloop="always"
      aria-hidden
    >
      <View.Port />
      <Preload all />
    </Canvas>
  );
}
