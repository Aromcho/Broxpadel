import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db, schema } from '../db/db';
import { PricingService, CartLine } from './pricing.service';
import { MailService, STATUS_LABEL } from '../mail/mail.service';
import { RevalidateService } from '../common/revalidate.service';
import { ActivityService } from '../common/activity.service';
import { config } from '../config';

export type OrderStatus = (typeof schema.orderStatusEnum.enumValues)[number];
const money = (n: number) => '$' + n.toLocaleString('es-AR');

export type CheckoutInput = {
  items: CartLine[];
  paymentMethod: 'mercadopago' | 'transfer' | 'whatsapp';
  customer: { name: string; email?: string | null; phone?: string | null };
  zoneId: number;
  address?: string | null; city?: string | null; province?: string | null; postcode?: string | null;
  couponCode?: string | null;
  note?: string | null;
};

@Injectable()
export class OrdersService {
  private log = new Logger('Orders');
  constructor(private pricing: PricingService, private mail: MailService, private reval: RevalidateService, private activity: ActivityService) {}

  async create(input: CheckoutInput) {
    const q = await this.pricing.quote({ items: input.items, couponCode: input.couponCode, postcode: input.postcode, province: input.province, zoneId: input.zoneId });
    if (!q.shipping) throw new BadRequestException('Elegí una forma de envío válida para tu código postal');
    if (q.shipping.type === 'zone' && (!input.address || !input.city || !input.postcode)) throw new BadRequestException('Completá la dirección de envío');
    if (input.couponCode && q.couponError) throw new BadRequestException(q.couponError);
    const [biz] = await db.select().from(schema.business).where(eq(schema.business.id, 1));
    const transferDiscount = input.paymentMethod === 'transfer' ? q.transferDiscount : 0;
    const total = q.total - transferDiscount;

    const order = await db.transaction(async (tx) => {
      // bloqueo de stock por variante
      const ids = q.lines.map((l) => l.variantId);
      const locked = await tx.select().from(schema.variants).where(inArray(schema.variants.id, ids)).for('update');
      for (const l of q.lines) {
        const v = locked.find((x) => x.id === l.variantId)!;
        if (v.stock < l.qty) throw new BadRequestException(`Sin stock suficiente de ${l.name} talle ${l.size} (quedan ${Math.max(0, v.stock)})`);
      }
      for (const l of q.lines) {
        await tx.update(schema.variants).set({ stock: sql`${schema.variants.stock} - ${l.qty}` }).where(eq(schema.variants.id, l.variantId));
      }
      const [o] = await tx.insert(schema.orders).values({
        number: `TMP-${randomBytes(4).toString('hex')}`, token: randomBytes(12).toString('hex'),
        status: 'pending_payment', paymentMethod: input.paymentMethod,
        customerName: input.customer.name.trim(), customerEmail: input.customer.email?.trim().toLowerCase() || null, customerPhone: input.customer.phone?.trim() || null,
        shippingZoneId: q.shipping!.zoneId, shippingName: q.shipping!.name,
        address: q.shipping!.type === 'zone' ? input.address : null, city: q.shipping!.type === 'zone' ? input.city : null,
        province: q.shipping!.type === 'zone' ? input.province : null, postcode: input.postcode ?? null,
        subtotal: q.subtotal, discount: q.discount, transferDiscount, shippingCost: q.shipping!.cost, shippingToQuote: q.shipping!.toQuote, total,
        couponCode: q.coupon?.code ?? null, customerNote: input.note ?? null,
      }).returning();
      const number = `BX-${String(1000 + o.id)}`;
      const [o2] = await tx.update(schema.orders).set({ number }).where(eq(schema.orders.id, o.id)).returning();
      await tx.insert(schema.orderItems).values(q.lines.map((l) => ({
        orderId: o.id, productId: l.productId, variantId: l.variantId, name: l.name, size: l.size, color: l.color, sku: l.sku, image: l.image, unitPrice: l.unitPrice, qty: l.qty,
      })));
      if (q.coupon) await tx.update(schema.coupons).set({ used: sql`${schema.coupons.used} + 1` }).where(eq(schema.coupons.code, q.coupon.code));
      await tx.insert(schema.orderEvents).values({ orderId: o.id, type: 'created', message: `Pedido creado · ${this.methodLabel(input.paymentMethod)} · ${money(total)}`, by: input.customer.name });
      return o2;
    });

    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    await this.activity.log({ name: order.customerName }, 'order', 'order', order.id, `Nuevo pedido ${order.number} (${this.methodLabel(order.paymentMethod)}) · ${money(order.total)}`);
    this.mail.orderCreated(order, items, { transferInfo: biz?.transferInfo }).catch(() => undefined);
    this.reval.tags('products').catch(() => undefined); // el stock cambió
    return { order, items, whatsappUrl: this.whatsappUrl(biz?.whatsapp, order, items) };
  }

  methodLabel(m: string) {
    return m === 'mercadopago' ? 'Mercado Pago' : m === 'transfer' ? 'Transferencia' : 'WhatsApp';
  }

  whatsappUrl(phone: string | null | undefined, o: typeof schema.orders.$inferSelect, items: (typeof schema.orderItems.$inferSelect)[]) {
    if (!phone) return null;
    const lines = [
      `¡Hola Brox! 👋 Quiero hacer este pedido (*${o.number}*):`,
      '',
      ...items.map((i) => `• ${i.qty} × ${i.name}${i.size ? ` — talle ${i.size}` : ''} (${money(i.unitPrice * i.qty)})`),
      '',
      `Subtotal: ${money(o.subtotal)}`,
      ...(o.discount ? [`Descuento${o.couponCode ? ` (${o.couponCode})` : ''}: −${money(o.discount)}`] : []),
      ...(o.transferDiscount ? [`Descuento transferencia: −${money(o.transferDiscount)}`] : []),
      `${o.shippingName}: ${o.shippingToQuote ? 'a coordinar' : o.shippingCost ? money(o.shippingCost) : 'gratis'}`,
      `*Total: ${money(o.total)}*`,
      '',
      `Pago: ${this.methodLabel(o.paymentMethod)}`,
      ...(o.address ? [`Envío a: ${o.address}, ${o.city ?? ''} (${o.postcode ?? ''})`] : []),
      `A nombre de: ${o.customerName}`,
      '',
      `Estado del pedido: ${config.publicUrl}/pedido/${o.number}?t=${o.token}`,
    ];
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  async byNumber(number: string, token?: string) {
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
    if (!o || (token !== undefined && o.token !== token)) throw new NotFoundException('Pedido no encontrado');
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
    const events = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, o.id)).orderBy(desc(schema.orderEvents.createdAt));
    return { order: o, items, events };
  }

  async setStatus(id: number, status: OrderStatus, by: string, extra: { trackingCode?: string | null; trackingUrl?: string | null; message?: string } = {}) {
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
    if (!o) throw new NotFoundException('Pedido no encontrado');
    const patch: Partial<typeof schema.orders.$inferInsert> = { status, updatedAt: new Date() };
    if (extra.trackingCode !== undefined) patch.trackingCode = extra.trackingCode;
    if (extra.trackingUrl !== undefined) patch.trackingUrl = extra.trackingUrl;
    if (status === 'paid' && !o.paidAt) patch.paidAt = new Date();
    await db.transaction(async (tx) => {
      // al cancelar se devuelve el stock (una sola vez); si se reactiva, se vuelve a descontar
      const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
      if (status === 'cancelled' && !o.stockRestored) {
        for (const i of items) if (i.variantId) await tx.update(schema.variants).set({ stock: sql`${schema.variants.stock} + ${i.qty}` }).where(eq(schema.variants.id, i.variantId));
        patch.stockRestored = true;
      } else if (status !== 'cancelled' && o.stockRestored) {
        for (const i of items) if (i.variantId) await tx.update(schema.variants).set({ stock: sql`${schema.variants.stock} - ${i.qty}` }).where(eq(schema.variants.id, i.variantId));
        patch.stockRestored = false;
      }
      await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, id));
      if (o.status !== status) await tx.insert(schema.orderEvents).values({ orderId: id, type: 'status', message: extra.message ?? `${STATUS_LABEL[o.status]} → ${STATUS_LABEL[status]}`, by });
    });
    const res = await this.byNumber(o.number);
    if (o.status !== status && res.order.customerEmail && status !== 'pending_payment') this.mail.orderStatus(res.order, res.items).catch(() => undefined);
    if (status === 'cancelled' || o.stockRestored) this.reval.tags('products').catch(() => undefined);
    return res;
  }

  /** Cancela pedidos de Mercado Pago que quedaron sin pagar y devuelve el stock. */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePending() {
    const limit = new Date(Date.now() - config.pendingOrderTtlHours * 3600_000);
    const stale = await db.select().from(schema.orders).where(and(eq(schema.orders.status, 'pending_payment'), eq(schema.orders.paymentMethod, 'mercadopago'), lt(schema.orders.createdAt, limit)));
    for (const o of stale) {
      await this.setStatus(o.id, 'cancelled', 'sistema', { message: `Cancelado automáticamente: sin pago en ${config.pendingOrderTtlHours} h` });
      this.log.log(`Pedido ${o.number} cancelado por falta de pago`);
    }
  }
}
