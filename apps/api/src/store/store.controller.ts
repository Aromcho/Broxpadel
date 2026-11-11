import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CatalogService } from './catalog.service';
import { PricingService } from '../orders/pricing.service';
import { OrdersService } from '../orders/orders.service';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { parse } from '../common/zod';
import { config } from '../config';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cartSchema = z.array(z.object({ variantId: z.coerce.number().int().positive(), qty: z.coerce.number().int().min(1).max(20) })).min(1).max(30);

@Controller('store')
export class StoreController {
  constructor(private catalog: CatalogService, private pricing: PricingService, private orders: OrdersService, private mp: MercadoPagoService) {}

  /** Todo lo que necesita el layout y la portada en una sola llamada. */
  @Get('bootstrap')
  async bootstrap() {
    const [business, categories, collections, stories, banners, zones, products, court, backgrounds] = await Promise.all([
      this.catalog.business(), this.catalog.categories(), this.catalog.collections(), this.catalog.stories(), this.catalog.banners(),
      this.catalog.shippingZones(), this.catalog.products(), this.catalog.taggedVideos('court'), this.catalog.taggedVideos('bg'),
    ]);
    return {
      business, categories, collections, stories, banners, products,
      shipping: zones.map((z) => ({ id: z.id, name: z.name, type: z.type, price: z.price, freeFrom: z.freeFrom, eta: z.eta, toQuote: z.toQuote })),
      courtVideos: court, backgroundVideos: backgrounds,
      payments: { mercadopago: this.mp.enabled, mpPublicKey: config.mp.publicKey || null },
    };
  }

  @Get('products')
  async products(@Query() q: Record<string, string>) {
    let list = await this.catalog.products();
    if (q.category) list = list.filter((p) => p.category?.slug === q.category);
    if (q.collection) list = list.filter((p) => p.collections.some((c) => c.slug === q.collection));
    if (q.size) list = list.filter((p) => p.variants.some((v) => v.size === q.size && v.available));
    if (q.color) list = list.filter((p) => norm(p.colorName ?? '') === norm(q.color));
    if (q.min) list = list.filter((p) => p.price >= Number(q.min));
    if (q.max) list = list.filter((p) => p.price <= Number(q.max));
    if (q.q) {
      const terms = norm(q.q).split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const hay = norm([p.name, p.subtitle, p.colorName, p.category?.name, p.description, ...p.collections.map((c) => c.name)].join(' '));
        return terms.every((t) => hay.includes(t));
      });
    }
    return list;
  }

  @Get('products/:slug')
  async product(@Param('slug') slug: string) {
    const all = await this.catalog.products();
    const p = all.find((x) => x.slug === slug);
    if (!p) throw new NotFoundException('Producto no encontrado');
    const family = p.family ? all.filter((x) => x.family === p.family) : [p];
    const related = all
      .filter((x) => x.id !== p.id && !family.some((f) => f.id === x.id))
      .map((x) => ({ x, score: (x.category?.id === p.category?.id ? 2 : 0) + (x.garment !== p.garment ? 1.5 : 0) + (x.featured ? 0.5 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.x);
    return { product: p, family, related };
  }

  @Get('slugs')
  async slugs() {
    const [products, categories, collections] = await Promise.all([this.catalog.products(), this.catalog.categories(), this.catalog.collections()]);
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
      categories: categories.map((c) => c.slug),
      collections: collections.map((c) => c.slug),
    };
  }

  @Post('quote')
  @HttpCode(200)
  async quote(@Body() body: unknown) {
    const b = parse(z.object({ items: cartSchema, couponCode: z.string().max(40).optional().nullable(), postcode: z.string().max(12).optional().nullable(), province: z.string().max(80).optional().nullable(), zoneId: z.coerce.number().int().optional().nullable() }), body);
    return this.pricing.quote(b);
  }

  @Post('checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkout(@Body() body: unknown) {
    const b = parse(z.object({
      items: cartSchema,
      paymentMethod: z.enum(['mercadopago', 'transfer', 'whatsapp']),
      customer: z.object({
        name: z.string().trim().min(2, 'Ingresá tu nombre').max(160),
        email: z.string().trim().email('Email inválido').max(160),
        phone: z.string().trim().min(6, 'Ingresá un teléfono').max(40),
      }),
      zoneId: z.coerce.number().int().positive('Elegí cómo recibirlo'),
      address: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().max(120).optional().nullable(),
      province: z.string().trim().max(120).optional().nullable(),
      postcode: z.string().trim().max(12).optional().nullable(),
      couponCode: z.string().trim().max(40).optional().nullable(),
      note: z.string().trim().max(500).optional().nullable(),
    }), body);
    const { order, items, whatsappUrl } = await this.orders.create(b);
    let payUrl: string | null = null;
    if (b.paymentMethod === 'mercadopago') payUrl = (await this.mp.createPreference(order, items)).url;
    return { number: order.number, token: order.token, total: order.total, paymentMethod: order.paymentMethod, payUrl, whatsappUrl };
  }

  @Get('orders/:number')
  async order(@Param('number') number: string, @Query('t') token: string) {
    const { order, items, events } = await this.orders.byNumber(number, token ?? '');
    const biz = await this.catalog.business();
    const { adminNotes, mpPreferenceId, stockRestored, ...pub } = order;
    void adminNotes; void mpPreferenceId; void stockRestored;
    return { order: pub, items, events: events.map(({ by, ...e }) => (void by, e)), whatsappUrl: this.orders.whatsappUrl(biz.whatsapp, order, items), transferInfo: order.paymentMethod === 'transfer' ? await this.transferInfo() : null };
  }

  /** Al volver de Mercado Pago: consulta el pago (útil en local, donde el webhook no llega). */
  @Post('orders/:number/sync')
  @HttpCode(200)
  async sync(@Param('number') number: string, @Query('t') token: string, @Body() body: { paymentId?: string }) {
    await this.orders.byNumber(number, token ?? '');
    if (body?.paymentId && /^\d+$/.test(body.paymentId) && this.mp.enabled) await this.mp.syncPayment(body.paymentId);
    return this.order(number, token);
  }

  @Post('orders/:number/pay')
  @HttpCode(200)
  async retryPay(@Param('number') number: string, @Query('t') token: string) {
    const { order, items } = await this.orders.byNumber(number, token ?? '');
    if (order.status !== 'pending_payment' || order.paymentMethod !== 'mercadopago') throw new NotFoundException('Este pedido no tiene un pago pendiente');
    return { payUrl: (await this.mp.createPreference(order, items)).url };
  }

  private async transferInfo() {
    const { db, schema } = await import('../db/db');
    const { eq } = await import('drizzle-orm');
    const [b] = await db.select({ t: schema.business.transferInfo }).from(schema.business).where(eq(schema.business.id, 1));
    return b?.t ?? null;
  }
}
