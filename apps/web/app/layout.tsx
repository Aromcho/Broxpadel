import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SITE_URL } from '@/lib/format';

const archivo = localFont({
  src: [
    { path: './fonts/Archivo.woff2', style: 'normal', weight: '100 900' },
    { path: './fonts/Archivo-Italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--font-archivo',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Brox Padel · Indumentaria de pádel', template: '%s · Brox Padel' },
  description: 'Remeras y shorts de pádel BROX con tecnología Dry-Wick y protección UPF 50+. Mirá la colección y comprá online. Envíos a todo el país.',
  applicationName: 'Brox Padel',
  keywords: ['pádel', 'padel', 'indumentaria de pádel', 'remeras de pádel', 'shorts de pádel', 'Brox', 'Villa Gesell', 'Dry-Wick'],
  openGraph: { type: 'website', locale: 'es_AR', siteName: 'Brox Padel', images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Brox Padel · Indumentaria de pádel' }] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico' }], apple: '/apple-icon.png' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#0a0f1a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
