'use client';
import { Suspense } from 'react';
import clsx from 'clsx';
import { View, Environment, ContactShadows } from '@react-three/drei';
import Garment from '@/three/garment/Garment';

/** La prenda girando dentro de la tarjeta (se dibuja en el lienzo compartido del catálogo). Se carga aparte para no sumar three.js si no se usa. */
export default function Card3D({ glb, garment, loaded, onLoaded }: { glb: string; garment: string; loaded: boolean; onLoaded: () => void }) {
  return (
    <View className={clsx('absolute inset-0 transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}>
      <color attach="background" args={['#ebe9e3']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[1.5, 2, 2]} intensity={1.4} />
      <Suspense fallback={null}>
        <Environment files="/hdri/studio_small_03_1k.hdr" environmentIntensity={0.75} />
        <group scale={garment === 'tee' ? 1.25 : 1.6} position={[0, 0.04, 0]}>
          <Garment url={glb} spin={0.55} onLoaded={onLoaded} />
        </group>
        <ContactShadows position={[0, -0.52, 0]} opacity={0.35} scale={2} blur={2.5} far={1} />
      </Suspense>
    </View>
  );
}
