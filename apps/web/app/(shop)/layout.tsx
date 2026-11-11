import { getBootstrap } from '@/lib/api';
import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import CartDrawer from '@/components/shop/CartDrawer';
import SmoothScroll from '@/components/shop/SmoothScroll';
import { SITE_URL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { business, categories } = await getBootstrap();
  const org = {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    '@id': `${SITE_URL}/#store`,
    name: business.name,
    description: business.description,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/brox-icon.png`,
    image: `${SITE_URL}/og.jpg`,
    telephone: business.whatsapp ? `+${business.whatsapp}` : undefined,
    email: business.email ?? undefined,
    address: { '@type': 'PostalAddress', addressLocality: business.city, addressRegion: business.province, addressCountry: 'AR', streetAddress: business.address ?? undefined },
    sameAs: [business.instagram && `https://www.instagram.com/${business.instagram}/`, business.tiendanube].filter(Boolean),
    paymentAccepted: 'Mercado Pago, Transferencia bancaria, Tarjeta de crédito, Tarjeta de débito',
    currenciesAccepted: 'ARS',
    areaServed: 'AR',
    openingHoursSpecification: business.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][h.day], opens: h.open, closes: h.close })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Saltar al contenido</a>
      <SmoothScroll />
      <Header announcement={business.announcement} />
      <main id="contenido">{children}</main>
      <Footer business={business} categories={categories} />
      <CartDrawer transferPct={business.transferDiscountPct} />
    </>
  );
}
