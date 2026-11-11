import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  const now = new Date();
  const base: MetadataRoute.Sitemap = ['', '/catalogo', '/contacto', '/envios-y-pagos', '/talles', '/arrepentimiento'].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.6 }));
  try {
    const r = await fetch(`${API}/api/store/slugs`, { next: { tags: ['products', 'catalog'] }, cache: 'force-cache' });
    const s = (await r.json()) as { products: { slug: string; updatedAt: string }[]; categories: string[]; collections: string[] };
    return [
      ...base,
      ...s.categories.map((c) => ({ url: `${SITE_URL}/catalogo?categoria=${c}`, lastModified: now, priority: 0.7 })),
      ...s.products.map((p) => ({ url: `${SITE_URL}/producto/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ];
  } catch {
    return base;
  }
}
