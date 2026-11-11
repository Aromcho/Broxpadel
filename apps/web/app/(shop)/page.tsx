import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';
import HeroVideos from '@/components/home/HeroVideos';
import Catalog from '@/components/shop/Catalog';
import Stories from '@/components/shop/Stories';
import { Collections, InfoStrip, OnCourt, PromoBanners, SectionTitle } from '@/components/home/Sections';
import Link from 'next/link';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function Home() {
  const data = await getBootstrap();
  const { business } = data;
  const features = [
    { kicker: 'Secado', title: 'Tecnología Dry-Wick', body: 'Secado ultrarrápido: cuando estás definiendo un partido, el sudor no es tema.' },
    { kicker: 'Protección', title: 'UPF 50+', body: 'Para esos partidos interminables a plena luz del día.' },
    { kicker: 'Comodidad', title: 'Poliéster ultraliviano', body: 'Tan liviano y respirable que vas a sentir que no llevás nada puesto.' },
    { kicker: 'Envíos', title: business.shippingText ?? 'Envíos a todo el país', body: business.transferDiscountPct ? `Y ${business.transferDiscountPct}% off si pagás con transferencia.` : 'Desde Villa Gesell a tu casa.' },
  ];
  return (
    <>
      <HeroVideos videos={[...data.backgroundVideos, ...data.courtVideos].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)} features={features} />

      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-16 pt-10 md:px-6 md:pt-16">
        <div id="historias" className="mb-10 scroll-mt-24"><Stories stories={data.stories} /></div>
        <Catalog
          products={data.products} categories={data.categories} collections={data.collections} initial={{}}
          transferPct={business.transferDiscountPct} limit={8} syncUrl={false}
          heading={<SectionTitle kicker="La colección" title="Remeras y shorts para jugar sin límites"><Link href="/catalogo" className="btn btn-ink">Ver todo ({data.products.length})</Link></SectionTitle>}
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <SectionTitle kicker="Colecciones" title="Armá tu conjunto" />
        <Collections collections={data.collections} />
      </section>

      <section id="en-la-cancha" className="on-night scroll-mt-16 bg-night py-16 text-white md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <SectionTitle kicker="Videos reales de @broxpadel" title="En la cancha" dark>
            {business.instagram && <a className="btn btn-chalk" href={`https://www.instagram.com/${business.instagram}/`} target="_blank" rel="noopener">Seguinos en Instagram</a>}
          </SectionTitle>
          <OnCourt products={data.products} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <PromoBanners banners={data.banners} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <InfoStrip business={business} />
      </section>
    </>
  );
}
