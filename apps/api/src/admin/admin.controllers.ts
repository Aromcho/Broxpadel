import { z } from 'zod';
import { schema } from '../db/db';
import { makeCrud } from './crud';
import { optStr, slugify } from '../common/zod';

const date = z.union([z.string(), z.null()]).optional().transform((v) => (v ? new Date(v) : null));
const mediaRef = z.number().int().positive().nullable().optional();

const category = z.object({
  name: z.string().trim().min(1).max(120), slug: z.string().trim().max(120).optional(), description: optStr(2000),
  coverId: mediaRef, sortOrder: z.number().int().optional(), visible: z.boolean().optional(),
});
const collection = z.object({
  name: z.string().trim().min(1).max(120), slug: z.string().trim().max(120).optional(), kicker: optStr(80), description: optStr(2000),
  coverId: mediaRef, videoId: mediaRef, featured: z.boolean().optional(), sortOrder: z.number().int().optional(), visible: z.boolean().optional(),
});
const withSlug = <T extends z.ZodObject>(s: T) => s.transform((v: Record<string, unknown>) => ({ ...v, slug: slugify(String(v.slug || v.name)) }));
const story = z.object({ title: z.string().trim().min(1).max(60), coverId: mediaRef, sortOrder: z.number().int().optional(), visible: z.boolean().optional() });
const storyItem = z.object({
  storyId: z.number().int().positive(), mediaId: z.number().int().positive(), caption: optStr(200), linkLabel: optStr(60), linkHref: optStr(300),
  duration: z.number().min(2).max(30).optional(), sortOrder: z.number().int().optional(),
});
const banner = z.object({
  placement: z.enum(['hero', 'promo', 'strip', 'court']).optional(), kicker: optStr(80), title: z.string().trim().min(1).max(160), subtitle: optStr(1000),
  ctaLabel: optStr(60), ctaHref: optStr(300), mediaId: mediaRef, videoId: mediaRef, active: z.boolean().optional(), startsAt: date, endsAt: date, sortOrder: z.number().int().optional(),
});
const coupon = z.object({
  code: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase().replace(/\s+/g, '')), type: z.enum(['percent', 'fixed', 'free_shipping']),
  value: z.number().int().min(0), minSubtotal: z.number().int().min(0).optional(), maxUses: z.number().int().positive().nullable().optional(),
  startsAt: date, endsAt: date, active: z.boolean().optional(), note: optStr(200),
});
const zone = z.object({
  name: z.string().trim().min(1).max(120), type: z.enum(['pickup', 'zone']),
  postcodes: z.array(z.object({ from: z.number().int(), to: z.number().int() })).optional(), provinces: z.array(z.string()).optional(),
  price: z.number().int().min(0), freeFrom: z.number().int().min(0).nullable().optional(), eta: optStr(80), toQuote: z.boolean().optional(), active: z.boolean().optional(), sortOrder: z.number().int().optional(),
});
const guide = z.object({
  name: z.string().trim().min(1).max(120), columns: z.array(z.string().max(40)).max(12), rows: z.array(z.array(z.string().max(40)).max(12)).max(20),
  notes: optStr(1000), imageId: mediaRef,
});

export const CategoriesCrud = makeCrud({ path: 'categories', table: schema.categories, entity: 'category', create: withSlug(category), update: withSlug(category.partial().extend({ name: z.string().trim().min(1).max(120) })), tags: ['catalog', 'products'], label: (r) => `la categoría “${r.name}”` });
export const CollectionsCrud = makeCrud({ path: 'collections', table: schema.collections, entity: 'collection', create: withSlug(collection), update: withSlug(collection.partial().extend({ name: z.string().trim().min(1).max(120) })), tags: ['catalog', 'products'], label: (r) => `la colección “${r.name}”` });
export const StoriesCrud = makeCrud({ path: 'stories', table: schema.stories, entity: 'story', create: story, update: story.partial(), tags: ['catalog'], label: (r) => `la historia “${r.title}”` });
export const StoryItemsCrud = makeCrud({ path: 'story-items', table: schema.storyItems, entity: 'story', create: storyItem, update: storyItem.partial(), tags: ['catalog'], label: () => 'un ítem de historia' });
export const BannersCrud = makeCrud({ path: 'banners', table: schema.banners, entity: 'banner', create: banner, update: banner.partial(), tags: ['catalog'], label: (r) => `el banner “${r.title}”` });
export const CouponsCrud = makeCrud({ path: 'coupons', table: schema.coupons, entity: 'coupon', create: coupon, update: coupon.partial(), tags: [], label: (r) => `el cupón ${r.code}`, roles: ['admin'], orderBy: schema.coupons.id });
export const ZonesCrud = makeCrud({ path: 'shipping-zones', table: schema.shippingZones, entity: 'shipping', create: zone, update: zone.partial(), tags: ['catalog'], label: (r) => `la zona de envío “${r.name}”`, roles: ['admin'] });
export const SizeGuidesCrud = makeCrud({ path: 'size-guides', table: schema.sizeGuides, entity: 'size-guide', create: guide, update: guide.partial(), tags: ['products'], label: (r) => `la guía de talles “${r.name}”`, orderBy: schema.sizeGuides.id });
