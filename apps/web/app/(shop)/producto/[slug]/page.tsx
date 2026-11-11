import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBootstrap, getProduct } from '@/lib/api';
import { SITE_URL, pick } from '@/lib/format';
import ProductView from '@/components/product/ProductView';
import ProductCard from '@/components/shop/ProductCard';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getProduct(slug);
  if (!d) return { title: 'Producto no encontrado' };
  const p = d.product;
  const img = p.images[0];
  return {
    title: p.name,
    description: p.seoDescription ?? p.description?.slice(0, 160),
    alternates: { canonical: `/producto/${p.slug}` },
    openGraph: { type: 'website', title: `${p.name} · Brox Padel`, description: p.seoDescription ?? undefined, images: img ? [{ url: pick(img, 1280), width: 1280, height: Math.round((img.h / img.w) * 1280), alt: p.name }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [d, boot] = await Promise.all([getProduct(slug), getBootstrap()]);
  if (!d) notFound();
  const { product: p, family, related } = d;
  const b = boot.business;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.variants[0]?.sku ?? undefined,
    description: p.description ?? undefined,
    color: p.colorName ?? undefined,
    category: p.category?.name,
    brand: { '@type': 'Brand', name: 'BROX' },
    image: p.images.slice(0, 4).map((i) => `${SITE_URL}${pick(i, 1280)}`),
    url: `${SITE_URL}/producto/${p.slug}`,
    offers: {
      '@type': 'AggregateOffer', priceCurrency: 'ARS', lowPrice: Math.min(...p.variants.map((v) => v.price)), highPrice: Math.max(...p.variants.map((v) => v.price)),
      offerCount: p.variants.length,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@id': `${SITE_URL}/#store` },
      offers: p.variants.map((v) => ({ '@type': 'Offer', sku: v.sku ?? undefined, name: `${p.name} talle ${v.size}`, price: v.price, priceCurrency: 'ARS', availability: v.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${SITE_URL}/producto/${p.slug}` })),
    },
  };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
    { '@type': 'ListItem', position: 3, name: p.name, item: `${SITE_URL}/producto/${p.slug}` },
  ] };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([ld, crumbs]) }} />
      <ProductView initial={p} family={family} business={{ whatsapp: b.whatsapp, transferDiscountPct: b.transferDiscountPct, shippingText: b.shippingText, installmentsText: b.installmentsText }} />
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 md:px-6" aria-labelledby="rel">
          <h2 id="rel" className="t-head text-[clamp(2rem,5vw,3rem)]">Combinala con</h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5 lg:grid-cols-4">
            {related.slice(0, 4).map((r) => <li key={r.id}><ProductCard p={r} transferPct={b.transferDiscountPct} /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
