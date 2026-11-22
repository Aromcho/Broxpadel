import { redirect } from 'next/navigation';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Producto del día', robots: { index: false } };

/** Link fijo de la bio de Instagram: siempre lleva al producto del día (con stock). Conserva los UTM. */
export default async function Hoy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') qs.set(k, v);
  if (!qs.has('utm_source')) { qs.set('utm_source', 'instagram'); qs.set('utm_medium', 'bio'); qs.set('utm_campaign', 'producto_del_dia'); }
  let slug: string | null = null;
  try {
    const r = await fetch(`${API}/api/store/today`, { cache: 'no-store' });
    if (r.ok) slug = ((await r.json()) as { slug: string | null }).slug;
  } catch { /* si la API no responde, al catálogo */ }
  redirect(slug ? `/producto/${slug}?${qs}` : `/catalogo?${qs}`);
}
