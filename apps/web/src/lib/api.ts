import 'server-only';
import type { Bootstrap, Product } from './types';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

/** Datos públicos cacheados por tag: el panel invalida con revalidateTag al guardar. */
async function get<T>(path: string, tags: string[]): Promise<T> {
  const r = await fetch(`${API}/api${path}`, { cache: 'force-cache', next: { tags } });
  if (!r.ok) {
    if (r.status === 404) throw Object.assign(new Error('not found'), { status: 404 });
    throw new Error(`API ${path} → ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const getBootstrap = () => get<Bootstrap>('/store/bootstrap', ['catalog', 'products']);
export const getProduct = (slug: string) =>
  get<{ product: Product; family: Product[]; related: Product[] }>(`/store/products/${encodeURIComponent(slug)}`, ['products', `product:${slug}`]).catch((e) => {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  });
