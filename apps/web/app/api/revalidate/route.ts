import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';

/** La API avisa qué tags cambiaron (panel admin) → la tienda los muestra al instante. */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-revalidate-secret') !== (process.env.REVALIDATE_SECRET ?? 'dev-revalidate')) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { tags } = (await req.json().catch(() => ({ tags: [] }))) as { tags?: string[] };
  for (const t of tags ?? []) revalidateTag(t, { expire: 0 });
  return Response.json({ ok: true, tags });
}
