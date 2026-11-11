import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/db';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { parse, intId, optStr, slugify } from '../common/zod';
import { CatalogService } from '../store/catalog.service';
import { RevalidateService } from '../common/revalidate.service';
import { ActivityService } from '../common/activity.service';

const productBody = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(160).optional(),
  subtitle: optStr(200), description: optStr(5000),
  features: z.array(z.string().trim().max(160)).max(12).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  family: optStr(80), colorName: optStr(60), colorHex: optStr(9), colorHex2: optStr(9),
  garment: z.enum(['tee', 'shorts', 'socks', 'other']).optional(),
  featured: z.boolean().optional(), isNew: z.boolean().optional(), visible: z.boolean().optional(), sortOrder: z.number().int().optional(),
  modelId: z.number().int().positive().nullable().optional(), usdzId: z.number().int().positive().nullable().optional(),
  sizeGuideId: z.number().int().positive().nullable().optional(),
  seoTitle: optStr(200), seoDescription: optStr(500),
  variants: z.array(z.object({
    id: z.number().int().positive().optional(), size: z.string().trim().min(1).max(20), sku: optStr(60),
    price: z.number().int().min(0).nullable().optional(), stock: z.number().int().min(0), lowStock: z.number().int().min(0).optional(), active: z.boolean().optional(),
  })).max(40).optional(),
  media: z.array(z.object({ mediaId: z.number().int().positive(), role: z.string().max(20).optional() })).max(40).optional(),
  collectionIds: z.array(z.number().int().positive()).optional(),
  reels: z.array(z.object({ mediaId: z.number().int().positive(), igUrl: optStr(300), caption: optStr(300), startAt: z.number().min(0).optional() })).max(10).optional(),
});

@Controller('admin/products')
@UseGuards(AuthGuard)
@Roles('admin', 'editor')
export class AdminProductsController {
  constructor(private catalog: CatalogService, private reval: RevalidateService, private act: ActivityService) {}

  @Get()
  list() {
    return this.catalog.products({ includeHidden: true });
  }

  @Get('low-stock')
  async lowStock() {
    const all = await this.catalog.products({ includeHidden: true });
    return all.flatMap((p) => p.variants.filter((v) => v.active && v.stock <= v.lowStock).map((v) => ({ productId: p.id, slug: p.slug, name: p.name, size: v.size, stock: v.stock, lowStock: v.lowStock, variantId: v.id, image: p.images[0]?.variants?.[0]?.url ?? null })));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [p] = await this.catalog.products({ includeHidden: true, ids: [parse(intId, id)] });
    if (!p) throw new NotFoundException();
    return p;
  }

  private async save(id: number | null, body: unknown, user: AuthUser) {
    const b = parse(productBody, body);
    const { variants, media, collectionIds, reels, ...fields } = b;
    const data = { ...fields, slug: slugify(b.slug || b.name), features: b.features ?? [], updatedAt: new Date() };
    const pid = await db.transaction(async (tx) => {
      let pid = id;
      if (pid) {
        const [r] = await tx.update(schema.products).set(data).where(eq(schema.products.id, pid)).returning();
        if (!r) throw new NotFoundException();
      } else {
        const [r] = await tx.insert(schema.products).values(data).returning();
        pid = r.id;
      }
      if (variants) {
        const keep = variants.filter((v) => v.id).map((v) => v.id!);
        await tx.delete(schema.variants).where(keep.length ? and(eq(schema.variants.productId, pid), notInArray(schema.variants.id, keep)) : eq(schema.variants.productId, pid));
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const row = { productId: pid, size: v.size, sku: v.sku ?? null, price: v.price ?? null, stock: v.stock, lowStock: v.lowStock ?? 2, active: v.active ?? true, sortOrder: i };
          if (v.id) await tx.update(schema.variants).set(row).where(and(eq(schema.variants.id, v.id), eq(schema.variants.productId, pid)));
          else await tx.insert(schema.variants).values(row);
        }
      }
      if (media) {
        await tx.delete(schema.productMedia).where(eq(schema.productMedia.productId, pid));
        const seen = new Set<number>();
        const rows = media.filter((m) => (seen.has(m.mediaId) ? false : (seen.add(m.mediaId), true))).map((m, i) => ({ productId: pid!, mediaId: m.mediaId, role: m.role ?? 'gallery', sortOrder: i }));
        if (rows.length) await tx.insert(schema.productMedia).values(rows);
      }
      if (collectionIds) {
        await tx.delete(schema.productCollections).where(eq(schema.productCollections.productId, pid));
        if (collectionIds.length) await tx.insert(schema.productCollections).values([...new Set(collectionIds)].map((c, i) => ({ productId: pid!, collectionId: c, sortOrder: i })));
      }
      if (reels) {
        await tx.delete(schema.productReels).where(eq(schema.productReels.productId, pid));
        if (reels.length) await tx.insert(schema.productReels).values(reels.map((r, i) => ({ productId: pid!, mediaId: r.mediaId, igUrl: r.igUrl ?? null, caption: r.caption ?? null, startAt: r.startAt ?? 0, sortOrder: i })));
      }
      return pid;
    });
    await this.act.log(user, id ? 'update' : 'create', 'product', pid, `${id ? 'Editó' : 'Creó'} el producto “${b.name}”`);
    await this.reval.tags('products', `product:${data.slug}`, 'catalog');
    return this.get(String(pid));
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.save(null, body, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.save(parse(intId, id), body, user);
  }

  /** Cambios rápidos desde el listado (visible, destacado, stock de una variante). */
  @Patch(':id/quick')
  async quick(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    const pid = parse(intId, id);
    const b = parse(z.object({ visible: z.boolean().optional(), featured: z.boolean().optional(), isNew: z.boolean().optional(), price: z.number().int().min(0).optional(), variant: z.object({ id: z.number().int(), stock: z.number().int().min(0) }).optional() }), body);
    const { variant, ...fields } = b;
    if (Object.keys(fields).length) await db.update(schema.products).set({ ...fields, updatedAt: new Date() }).where(eq(schema.products.id, pid));
    if (variant) await db.update(schema.variants).set({ stock: variant.stock }).where(and(eq(schema.variants.id, variant.id), eq(schema.variants.productId, pid)));
    const p = await this.get(id);
    await this.act.log(user, 'update', 'product', pid, `Actualizó “${p.name}”${variant ? ` (stock ${p.variants.find((v) => v.id === variant.id)?.size}: ${variant.stock})` : ''}`);
    await this.reval.tags('products', `product:${p.slug}`);
    return p;
  }

  @Put('order')
  async reorder(@Body() body: unknown) {
    const ids = parse(z.object({ ids: z.array(z.number().int()) }), body).ids;
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.update(schema.products).set({ sortOrder: i }).where(eq(schema.products.id, ids[i]));
    });
    await this.reval.tags('products');
    return { ok: true };
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const p = await this.get(id);
    return this.save(null, {
      ...p, name: `${p.name} (copia)`, slug: `${p.slug}-copia-${Date.now().toString(36)}`, visible: false, categoryId: p.category?.id ?? null,
      modelId: p.model?.id ?? null, usdzId: p.model?.usdzId ?? null, sizeGuideId: p.sizeGuide?.id ?? null,
      variants: p.variants.map((v) => ({ size: v.size, sku: null, price: v.price === p.price ? null : v.price, stock: 0, lowStock: v.lowStock, active: v.active })),
      media: p.images.map((m) => ({ mediaId: m.id, role: m.role })), collectionIds: p.collections.map((c) => c.id),
      reels: p.reels.map((r) => ({ mediaId: r.video!.id, igUrl: r.igUrl, caption: r.caption, startAt: r.startAt })),
    }, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const [p] = await db.delete(schema.products).where(eq(schema.products.id, parse(intId, id))).returning();
    if (p) await this.act.log(user, 'delete', 'product', p.id, `Eliminó el producto “${p.name}”`);
    await this.reval.tags('products', 'catalog');
    return { ok: true };
  }

  @Get('meta/options')
  async options() {
    const [cats, cols, guides, families] = await Promise.all([
      db.select().from(schema.categories), db.select().from(schema.collections), db.select().from(schema.sizeGuides),
      db.selectDistinct({ family: schema.products.family }).from(schema.products),
    ]);
    return { categories: cats, collections: cols, sizeGuides: guides, families: families.map((f) => f.family).filter(Boolean) };
  }
}

export const _inArray = inArray;
