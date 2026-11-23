import { Body, Controller, Get, Header, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { config, mediaDir } from '../config';
import { CatalogService } from '../store/catalog.service';
import { BROWSER_EVENTS, TrackingService } from './tracking.service';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tag = (k: string, v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '' : `<g:${k}>${esc(String(v))}</g:${k}>`);

const eventSchema = z.object({
  event: z.enum(BROWSER_EVENTS),
  eventId: z.string().min(4).max(80),
  url: z.string().max(500).optional().nullable(),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(300).optional().nullable(),
  data: z.object({
    value: z.number().nonnegative().max(10_000_000).optional(),
    contentIds: z.array(z.string().max(60)).max(50).optional(),
    contents: z.array(z.object({ id: z.string().max(60), quantity: z.number().int().min(1).max(100), item_price: z.number().nonnegative().optional() })).max(50).optional(),
    numItems: z.number().int().min(0).max(500).optional(),
    contentName: z.string().max(200).optional(),
  }).default({}),
});

/** El navegador avisa los eventos del píxel para mandarlos también desde el servidor (API de conversiones). */
@Controller('track')
export class TrackingController {
  constructor(private tracking: TrackingService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async event(@Body() body: unknown, @Req() req: Request) {
    const r = eventSchema.safeParse(body);
    if (!r.success) return;
    const b = r.data;
    void this.tracking.browserEvent(b.event, b.eventId, { fbp: b.fbp, fbc: b.fbc, url: b.url, ip: req.ip, ua: req.headers['user-agent'] ?? null }, b.data);
  }
}

/** Catálogo de productos para Meta (y Google Merchant Center): un ítem por prenda y color, con stock y precio al día. */
@Controller('feed')
export class FeedController {
  constructor(private catalog: CatalogService) {}

  @Get('products.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=900')
  async products() {
    const list = await this.catalog.products();
    const site = config.publicUrl;
    const imgUrl = (id: number) => `${site}/api/feed/img/${id}.jpg`;
    const items = list.map((p) => {
      const imgs = [...p.images].sort((a, b) => Number(b.role === 'front') - Number(a.role === 'front'));
      const sale = p.compareAtPrice && p.compareAtPrice > p.price;
      const sizes = p.variants.filter((v) => v.available).map((v) => v.size);
      return [
        '<item>',
        tag('id', p.id),
        tag('title', p.name),
        tag('description', p.description || p.subtitle || p.name),
        tag('link', `${site}/producto/${p.slug}`),
        imgs[0] ? tag('image_link', imgUrl(imgs[0].id)) : '',
        ...imgs.slice(1, 10).map((i) => tag('additional_image_link', imgUrl(i.id))),
        tag('availability', p.inStock ? 'in stock' : 'out of stock'),
        tag('inventory', p.totalStock),
        tag('condition', 'new'),
        tag('price', `${sale ? p.compareAtPrice : p.price}.00 ARS`),
        sale ? tag('sale_price', `${p.price}.00 ARS`) : '',
        tag('brand', 'BROX'),
        tag('google_product_category', 'Apparel & Accessories > Clothing > Activewear'),
        tag('product_type', p.category?.name ?? (p.garment === 'shorts' ? 'Shorts' : 'Remeras')),
        tag('color', p.colorName),
        tag('size', sizes.join(', ')),
        tag('age_group', 'adult'),
        p.family ? tag('item_group_id', p.family) : '',
        '</item>',
      ].filter(Boolean).join('');
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Brox Padel</title><link>${esc(site)}</link><description>Indumentaria de pádel BROX</description>\n${items.join('\n')}\n</channel></rss>\n`;
  }

  /** Las fotos de la tienda están en WebP: para el catálogo se sirven en JPG (se generan una vez y quedan guardadas). */
  @Get('img/:file')
  async image(@Param('file') file: string, @Res() res: Response) {
    const m = /^(\d+)\.jpg$/.exec(file);
    if (!m) throw new NotFoundException();
    const id = Number(m[1]);
    const dir = join(mediaDir, 'feed');
    const out = join(dir, `${id}.jpg`);
    if (!existsSync(out)) {
      const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id));
      if (!row || row.kind !== 'image') throw new NotFoundException();
      const src = [...(row.variants ?? [])].sort((a, b) => b.w - a.w)[0]?.url ?? row.url;
      mkdirSync(dir, { recursive: true });
      await sharp(join(mediaDir, src.replace(/^\/media\//, '')), { failOn: 'none' }).flatten({ background: '#ffffff' }).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(out);
  }
}
