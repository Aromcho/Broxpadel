import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';
import Catalog, { type Filters } from '@/components/shop/Catalog';
import Stories from '@/components/shop/Stories';

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const { categories, collections } = await getBootstrap();
  const cat = categories.find((c) => c.slug === sp.categoria);
  const col = collections.find((c) => c.slug === sp.coleccion);
  const title = cat?.name ?? col?.name ?? (sp.q ? `Resultados para “${sp.q}”` : 'Catálogo');
  return { title, description: cat?.description ?? col?.description ?? 'Todas las remeras y shorts de pádel BROX: Dry-Wick, UPF 50+ y envíos a todo el país.', alternates: { canonical: cat ? `/catalogo?categoria=${cat.slug}` : '/catalogo' }, robots: sp.q ? { index: false } : undefined };
}

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const d = await getBootstrap();
  const initial: Filters = { categoria: sp.categoria, coleccion: sp.coleccion, talle: sp.talle, color: sp.color, precio: sp.precio, q: sp.q, orden: sp.orden as Filters['orden'] };
  const cat = d.categories.find((c) => c.slug === sp.categoria);
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: d.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `/producto/${p.slug}`, name: p.name })) };
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="t-head text-[clamp(2.6rem,8vw,4.6rem)]">{cat?.name ?? 'Catálogo'}</h1>
      <p className="mt-2 max-w-[56ch] text-mute">{cat?.description ?? 'Remeras y shorts de pádel con tecnología Dry-Wick y protección UPF 50+. Activá la vista 3D para girar cada prenda.'}</p>
      <div className="mb-6 mt-6"><Stories stories={d.stories} /></div>
      <Catalog products={d.products} categories={d.categories} collections={d.collections} initial={initial} transferPct={d.business.transferDiscountPct} />
    </div>
  );
}
