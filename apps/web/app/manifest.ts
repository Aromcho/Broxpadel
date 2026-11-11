import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brox Padel · Indumentaria de pádel', short_name: 'Brox Padel', description: 'Remeras y shorts de pádel BROX. Mirá la colección y comprá online.',
    start_url: '/', display: 'standalone', background_color: '#0a0f1a', theme_color: '#fb2324', lang: 'es-AR',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  };
}
