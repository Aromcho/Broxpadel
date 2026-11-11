import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/db';

type Media = typeof schema.media.$inferSelect;
export type PublicImage = {
  id: number; url: string; w: number; h: number; blur: string | null; dominant: string | null; alt: string | null;
  variants: { w: number; h: number; url: string }[];
};
export type PublicVideo = {
  id: number; title: string | null; w: number; h: number; duration: number | null;
  sources: NonNullable<Media['sources']>; poster: PublicImage | null;
};

export const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', '16', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ÚNICO'];
export const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 999 : i;
};

@Injectable()
export class CatalogService {
  async mediaMap(ids: (number | null | undefined)[]) {
    const clean = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
    const map = new Map<number, Media>();
    if (!clean.length) return map;
    const rows = await db.select().from(schema.media).where(inArray(schema.media.id, clean));
    // pósters de videos
    const posterIds = rows.map((r) => r.posterId).filter((x): x is number => !!x && !clean.includes(x));
    const posters = posterIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, posterIds)) : [];
    for (const r of [...rows, ...posters]) map.set(r.id, r);
    return map;
  }

  img(m: Media | undefined | null): PublicImage | null {
    if (!m || m.kind !== 'image') return null;
    return { id: m.id, url: m.url, w: m.width ?? 0, h: m.height ?? 0, blur: m.blur, dominant: m.dominant, alt: m.alt ?? m.title, variants: m.variants ?? [] };
  }
  video(m: Media | undefined | null, map: Map<number, Media>): PublicVideo | null {
    if (!m || m.kind !== 'video') return null;
    return { id: m.id, title: m.title, w: m.width ?? 0, h: m.height ?? 0, duration: m.duration, sources: m.sources ?? {}, poster: this.img(m.posterId ? map.get(m.posterId) : null) };
  }

  async business() {
    const [b] = await db.select().from(schema.business).where(eq(schema.business.id, 1));
    const hours = await db.select().from(schema.hours).orderBy(asc(schema.hours.day), asc(schema.hours.open));
    const map = await this.mediaMap([b?.logoId]);
    const { transferInfo, ...pub } = b ?? ({} as typeof schema.business.$inferSelect);
    return { ...pub, hasTransferInfo: !!transferInfo, logo: this.img(b?.logoId ? map.get(b.logoId) : null), hours };
  }

  /** Carga productos completos (el catálogo es chico: se arma en memoria). */
  async products(opts: { includeHidden?: boolean; ids?: number[] } = {}) {
    let rows = await db.select().from(schema.products).orderBy(asc(schema.products.sortOrder), asc(schema.products.id));
    if (!opts.includeHidden) rows = rows.filter((p) => p.visible);
    if (opts.ids) rows = rows.filter((p) => opts.ids!.includes(p.id));
    if (!rows.length) return [];
    const ids = rows.map((p) => p.id);
    const [vars, pm, pc, reels, cats, cols, guides] = await Promise.all([
      db.select().from(schema.variants).where(inArray(schema.variants.productId, ids)),
      db.select().from(schema.productMedia).where(inArray(schema.productMedia.productId, ids)).orderBy(asc(schema.productMedia.sortOrder)),
      db.select().from(schema.productCollections).where(inArray(schema.productCollections.productId, ids)),
      db.select().from(schema.productReels).where(inArray(schema.productReels.productId, ids)).orderBy(asc(schema.productReels.sortOrder)),
      db.select().from(schema.categories),
      db.select().from(schema.collections),
      db.select().from(schema.sizeGuides),
    ]);
    const map = await this.mediaMap([...pm.map((x) => x.mediaId), ...rows.flatMap((p) => [p.modelId, p.usdzId]), ...reels.map((r) => r.mediaId)]);
    return rows.map((p) => {
      const pv = vars.filter((v) => v.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder || sizeRank(a.size) - sizeRank(b.size));
      const images = pm.filter((x) => x.productId === p.id).map((x) => ({ role: x.role, ...this.img(map.get(x.mediaId))! })).filter((x) => x.id);
      const cat = cats.find((c) => c.id === p.categoryId);
      const variantsOut = pv.filter((v) => v.active || opts.includeHidden).map((v) => ({
        id: v.id, size: v.size, sku: v.sku, price: v.price ?? p.price, stock: v.stock, lowStock: v.lowStock, active: v.active, available: v.active && v.stock > 0,
      }));
      const model = p.modelId ? map.get(p.modelId) : null;
      const usdz = p.usdzId ? map.get(p.usdzId) : null;
      return {
        id: p.id, slug: p.slug, name: p.name, subtitle: p.subtitle, description: p.description, features: p.features,
        price: p.price, compareAtPrice: p.compareAtPrice, family: p.family, colorName: p.colorName, colorHex: p.colorHex, colorHex2: p.colorHex2,
        garment: p.garment, featured: p.featured, isNew: p.isNew, visible: p.visible, sortOrder: p.sortOrder, createdAt: p.createdAt, updatedAt: p.updatedAt,
        seoTitle: p.seoTitle, seoDescription: p.seoDescription, sourceUrl: p.sourceUrl,
        category: cat ? { id: cat.id, slug: cat.slug, name: cat.name } : null,
        collections: pc.filter((x) => x.productId === p.id).map((x) => cols.find((c) => c.id === x.collectionId)).filter(Boolean).map((c) => ({ id: c!.id, slug: c!.slug, name: c!.name })),
        images,
        model: model ? { id: model.id, glb: model.url, size: model.size, usdz: usdz?.url ?? null, usdzId: usdz?.id ?? null } : null,
        variants: variantsOut,
        sizes: variantsOut.map((v) => v.size),
        inStock: variantsOut.some((v) => v.available),
        totalStock: variantsOut.reduce((a, v) => a + Math.max(0, v.stock), 0),
        reels: reels.filter((r) => r.productId === p.id).map((r) => ({ id: r.id, igUrl: r.igUrl, caption: r.caption, startAt: r.startAt, video: this.video(map.get(r.mediaId), map) })).filter((r) => r.video),
        sizeGuide: guides.find((g) => g.id === p.sizeGuideId) ?? null,
      };
    });
  }

  async categories(all = false) {
    const rows = await db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder));
    const map = await this.mediaMap(rows.map((r) => r.coverId));
    return rows.filter((r) => all || r.visible).map((r) => ({ ...r, cover: this.img(r.coverId ? map.get(r.coverId) : null) }));
  }

  async collections(all = false) {
    const rows = await db.select().from(schema.collections).orderBy(asc(schema.collections.sortOrder));
    const map = await this.mediaMap(rows.flatMap((r) => [r.coverId, r.videoId]));
    return rows.filter((r) => all || r.visible).map((r) => ({ ...r, cover: this.img(r.coverId ? map.get(r.coverId) : null), video: this.video(r.videoId ? map.get(r.videoId) : null, map) }));
  }

  async stories(all = false) {
    const rows = await db.select().from(schema.stories).orderBy(asc(schema.stories.sortOrder));
    const items = rows.length ? await db.select().from(schema.storyItems).where(inArray(schema.storyItems.storyId, rows.map((r) => r.id))).orderBy(asc(schema.storyItems.sortOrder)) : [];
    const map = await this.mediaMap([...rows.map((r) => r.coverId), ...items.map((i) => i.mediaId)]);
    return rows.filter((r) => all || r.visible).map((r) => ({
      ...r, cover: this.img(r.coverId ? map.get(r.coverId) : null),
      items: items.filter((i) => i.storyId === r.id).map((i) => {
        const m = map.get(i.mediaId);
        return { ...i, kind: m?.kind, image: this.img(m), video: this.video(m, map) };
      }),
    }));
  }

  async banners(all = false) {
    const now = Date.now();
    const rows = await db.select().from(schema.banners).orderBy(asc(schema.banners.sortOrder));
    const map = await this.mediaMap(rows.flatMap((r) => [r.mediaId, r.videoId]));
    return rows
      .filter((r) => all || (r.active && (!r.startsAt || +r.startsAt <= now) && (!r.endsAt || +r.endsAt >= now)))
      .map((r) => ({ ...r, image: this.img(r.mediaId ? map.get(r.mediaId) : null), video: this.video(r.videoId ? map.get(r.videoId) : null, map) }));
  }

  async shippingZones(all = false) {
    const rows = await db.select().from(schema.shippingZones).orderBy(asc(schema.shippingZones.sortOrder));
    return rows.filter((r) => all || r.active);
  }

  /** Videos destacados para la cancha (tag "court") y fondos de sección (tag "bg"). */
  async taggedVideos(tag: string) {
    const rows = (await db.select().from(schema.media).where(eq(schema.media.kind, 'video')).orderBy(asc(schema.media.sortOrder), asc(schema.media.id)))
      .filter((m) => (m.tags ?? []).includes(tag));
    const map = await this.mediaMap(rows.flatMap((r) => [r.id, r.posterId]));
    return rows.map((r) => this.video(map.get(r.id), map)!);
  }
}
