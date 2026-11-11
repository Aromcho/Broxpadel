'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clock } from '../clock';

/** Prenda 3D (GLB con meshopt + WebP). Centrada, apoyada en y=0 y con giro suave opcional. */
export default function Garment({ url, spin = 0, onLoaded, tilt = 0.06 }: { url: string; spin?: number; onLoaded?: () => void; tilt?: number }) {
  const { scene } = useGLTF(url, false, true);
  const obj = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const c = box.getCenter(new THREE.Vector3());
    s.position.sub(c);
    s.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'envMapIntensity' in m) {
        m.envMapIntensity = 1.1;
        m.side = THREE.DoubleSide;
        if (m.map) m.map.anisotropy = 8;
      }
    });
    return s;
  }, [scene]);
  const g = useRef<THREE.Group>(null!);
  useEffect(() => { onLoaded?.(); }, [obj, onLoaded]);
  useFrame((_, dt) => {
    if (!spin) return;
    if (clock.capture) g.current.rotation.y = clock.time * spin;
    else g.current.rotation.y += dt * spin;
  });
  return (
    <group ref={g} rotation-x={tilt}>
      <primitive object={obj} />
    </group>
  );
}

export const preloadGarment = (url: string) => useGLTF.preload(url, false, true);
