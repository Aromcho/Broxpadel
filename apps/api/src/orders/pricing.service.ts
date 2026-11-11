import { BadRequestException, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/db';

export type CartLine = { variantId: number; qty: number };
export type Quote = {
  lines: {
    variantId: number; productId: number; name: string; size: string; color: string | null; sku: string | null;
    image: string | null; unitPrice: number; qty: number; total: number; stock: number; slug: string;
  }[];
  subtotal: number;
  discount: number;
  coupon: { code: string; type: string; value: number; label: string } | null;
  couponError: string | null;
  shipping: { zoneId: number; name: string; type: 'pickup' | 'zone'; cost: number; eta: string | null; toQuote: boolean } | null;
  shippingOptions: { zoneId: number; name: string; type: 'pickup' | 'zone'; cost: number; eta: string | null; free: boolean; toQuote: boolean }[];
  transferDiscountPct: number;
  transferDiscount: number;
  total: number;
  totalTransfer: number;
};

const fmt = (n: number) => '$' + n.toLocaleString('es-AR');

@Injectable()
export class PricingService {
  async couponFor(code: string | null | undefined, subtotal: number) {
    if (!code) return { coupon: null, error: null };
    const [c] = await db.select().from(schema.coupons).where(sql`upper(${schema.coupons.code}) = ${code.trim().toUpperCase()}`);
    const now = Date.now();
    if (!c || !c.active) return { coupon: null, error: 'El cupón no existe o no está activo' };
    if (c.startsAt && +c.startsAt > now) return { coupon: null, error: 'El cupón todavía no está vigente' };
    if (c.endsAt && +c.endsAt < now) return { coupon: null, error: 'El cupón está vencido' };
    if (c.maxUses != null && c.used >= c.maxUses) return { coupon: null, error: 'El cupón ya alcanzó su límite de usos' };
    if (subtotal < c.minSubtotal) return { coupon: null, error: `El cupón aplica a compras desde ${fmt(c.minSubtotal)}` };
    return { coupon: c, error: null };
  }

  zoneMatches(z: typeof schema.shippingZones.$inferSelect, postcode: number | null, province?: string | null) {
    if (z.type === 'pickup') return true;
    const hasPc = (z.postcodes ?? []).length > 0;
    const hasProv = (z.provinces ?? []).length > 0;
    if (!hasPc && !hasProv) return true; // resto del país
    if (hasPc && postcode != null && z.postcodes.some((r) => postcode >= r.from && postcode <= r.to)) return true;
    if (hasProv && province && z.provinces.map((p) => p.toLowerCase()).includes(province.toLowerCase())) return true;
    return false;
  }

  async quote(input: { items: CartLine[]; couponCode?: string | null; postcode?: string | null; province?: string | null; zoneId?: number | null }): Promise<Quote> {
    const items = input.items.filter((i) => i.qty > 0);
    if (!items.length) throw new BadRequestException('El carrito está vacío');
    const vIds = items.map((i) => i.variantId);
    const vars = await db.select().from(schema.variants).where(inArray(schema.variants.id, vIds));
    const prods = vars.length ? await db.select().from(schema.products).where(inArray(schema.products.id, [...new Set(vars.map((v) => v.productId))])) : [];
    const pm = prods.length ? await db.select({ productId: schema.productMedia.productId, url: schema.media.url, variants: schema.media.variants, sortOrder: schema.productMedia.sortOrder })
      .from(schema.productMedia).innerJoin(schema.media, eq(schema.media.id, schema.productMedia.mediaId))
      .where(inArray(schema.productMedia.productId, prods.map((p) => p.id))) : [];
    const lines: Quote['lines'] = [];
    for (const it of items) {
      const v = vars.find((x) => x.id === it.variantId);
      const p = v && prods.find((x) => x.id === v.productId);
      if (!v || !p || !v.active || !p.visible) throw new BadRequestException('Un producto del carrito ya no está disponible');
      const imgs = pm.filter((x) => x.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
      const thumb = imgs[0]?.variants?.find((x) => x.w >= 320)?.url ?? imgs[0]?.url ?? null;
      const unit = v.price ?? p.price;
      lines.push({ variantId: v.id, productId: p.id, slug: p.slug, name: p.name, size: v.size, color: p.colorName, sku: v.sku, image: thumb, unitPrice: unit, qty: it.qty, total: unit * it.qty, stock: v.stock });
    }
    const subtotal = lines.reduce((a, l) => a + l.total, 0);
    const { coupon, error } = await this.couponFor(input.couponCode, subtotal);
    let discount = 0;
    let freeShip = false;
    if (coupon) {
      if (coupon.type === 'percent') discount = Math.round((subtotal * coupon.value) / 100);
      if (coupon.type === 'fixed') discount = Math.min(subtotal, coupon.value);
      if (coupon.type === 'free_shipping') freeShip = true;
    }
    const zones = (await db.select().from(schema.shippingZones)).filter((z) => z.active).sort((a, b) => a.sortOrder - b.sortOrder);
    const pc = input.postcode ? parseInt(String(input.postcode).replace(/\D/g, ''), 10) : null;
    const after = subtotal - discount;
    const options = zones
      .filter((z) => z.type === 'pickup' || pc != null || input.province)
      .filter((z) => this.zoneMatches(z, Number.isFinite(pc as number) ? pc : null, input.province))
      .map((z) => {
        const free = !z.toQuote && (z.type === 'pickup' || freeShip || (z.freeFrom != null && after >= z.freeFrom));
        return { zoneId: z.id, name: z.name, type: z.type, cost: free || z.toQuote ? 0 : z.price, eta: z.eta, free, toQuote: z.toQuote };
      });
    // la zona más específica primero (con CP) y una sola “resto del país”
    const specific = options.filter((o) => o.type === 'zone' && (zones.find((z) => z.id === o.zoneId)!.postcodes.length || zones.find((z) => z.id === o.zoneId)!.provinces.length));
    const shippingOptions = [...options.filter((o) => o.type === 'pickup'), ...(specific.length ? specific : options.filter((o) => o.type === 'zone'))];
    const chosen = input.zoneId ? shippingOptions.find((o) => o.zoneId === input.zoneId) ?? null : null;
    const shipCost = chosen?.cost ?? 0;
    const [biz] = await db.select().from(schema.business).where(eq(schema.business.id, 1));
    const pct = biz?.transferDiscountPct ?? 0;
    const transferDiscount = Math.round((after * pct) / 100);
    const total = after + shipCost;
    return {
      lines, subtotal, discount,
      coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value, label: coupon.type === 'percent' ? `${coupon.value}% off` : coupon.type === 'fixed' ? `${fmt(coupon.value)} off` : 'Envío gratis' } : null,
      couponError: error,
      shipping: chosen ? { zoneId: chosen.zoneId, name: chosen.name, type: chosen.type, cost: chosen.cost, eta: chosen.eta, toQuote: chosen.toQuote } : null,
      shippingOptions,
      transferDiscountPct: pct,
      transferDiscount,
      total,
      totalTransfer: total - transferDiscount,
    };
  }
}
