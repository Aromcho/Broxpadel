import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { config } from '../config';
import { OrdersService } from '../orders/orders.service';


@Injectable()
export class MercadoPagoService {
  private log = new Logger('MercadoPago');
  constructor(private orders: OrdersService) {}

  get enabled() {
    return !!config.mp.accessToken;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(config.mp.apiBase + path, {
      ...init,
      headers: { authorization: `Bearer ${config.mp.accessToken}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    if (!r.ok) {
      this.log.error(`MP ${path} ${r.status}: ${text.slice(0, 400)}`);
      throw new BadRequestException('Mercado Pago no respondió bien. Probá de nuevo o elegí otro medio de pago.');
    }
    return JSON.parse(text) as T;
  }

  /** Checkout Pro: crea la preferencia y devuelve el link de pago. */
  async createPreference(order: typeof schema.orders.$inferSelect, items: (typeof schema.orderItems.$inferSelect)[]) {
    if (!this.enabled) throw new BadRequestException('Mercado Pago no está configurado (MP_ACCESS_TOKEN)');
    const productsTotal = order.total - order.shippingCost;
    const rawTotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
    const factor = rawTotal ? productsTotal / rawTotal : 1;
    const mpItems = items.map((i) => ({
      id: String(i.variantId ?? i.id), title: `${i.name}${i.size ? ` · Talle ${i.size}` : ''}`, quantity: i.qty, currency_id: 'ARS',
      unit_price: Math.round(i.unitPrice * factor * 100) / 100,
      picture_url: i.image ? `${config.publicUrl}${i.image}` : undefined,
    }));
    // ajuste de centavos para que la suma dé exacto
    const sum = mpItems.reduce((a, i) => a + i.unit_price * i.quantity, 0);
    const diff = Math.round((productsTotal - sum) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      const last = mpItems[mpItems.length - 1];
      if (last.quantity === 1) last.unit_price = Math.round((last.unit_price + diff) * 100) / 100;
      else mpItems.push({ id: 'ajuste', title: 'Ajuste de descuento', quantity: 1, currency_id: 'ARS', unit_price: diff, picture_url: undefined });
    }
    const back = `${config.publicUrl}/pedido/${order.number}?t=${order.token}`;
    const https = config.publicUrl.startsWith('https://');
    const notification = config.mp.notificationUrl || (https ? `${config.publicUrl}/api/payments/mp/webhook` : undefined);
    const pref = await this.call<{ id: string; init_point: string; sandbox_init_point: string }>('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: mpItems.filter((i) => i.unit_price > 0),
        payer: { name: order.customerName, email: order.customerEmail ?? undefined },
        external_reference: order.number,
        back_urls: { success: back, pending: back, failure: back },
        ...(https ? { auto_return: 'approved' } : {}),
        ...(notification ? { notification_url: notification } : {}),
        shipments: order.shippingCost ? { cost: order.shippingCost, mode: 'not_specified' } : undefined,
        statement_descriptor: 'BROX PADEL',
        metadata: { order_id: order.id },
      }),
    });
    await db.update(schema.orders).set({ mpPreferenceId: pref.id }).where(eq(schema.orders.id, order.id));
    const sandbox = config.mp.accessToken.startsWith('TEST-');
    return { preferenceId: pref.id, url: sandbox ? pref.sandbox_init_point ?? pref.init_point : pref.init_point };
  }

  /** Valida la firma x-signature del webhook (si hay MP_WEBHOOK_SECRET). */
  verifySignature(headers: Record<string, string | string[] | undefined>, dataId: string) {
    if (!config.mp.webhookSecret) return true;
    const sig = String(headers['x-signature'] ?? '');
    const reqId = String(headers['x-request-id'] ?? '');
    const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=') as [string, string]));
    if (!parts.ts || !parts.v1) return false;
    const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
    const expected = createHmac('sha256', config.mp.webhookSecret).update(manifest).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    } catch {
      return false;
    }
  }

  /** Consulta el pago en MP y actualiza el pedido (lo usan el webhook y la vuelta del checkout). */
  async syncPayment(paymentId: string) {
    const p = await this.call<{ id: number; status: string; status_detail: string; external_reference: string; transaction_amount: number }>(`/v1/payments/${paymentId}`);
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, p.external_reference));
    if (!o) {
      this.log.warn(`Pago ${paymentId} sin pedido (${p.external_reference})`);
      return null;
    }
    await db.update(schema.orders).set({ mpPaymentId: String(p.id), mpStatus: `${p.status}/${p.status_detail}`, updatedAt: new Date() }).where(eq(schema.orders.id, o.id));
    if (p.status === 'approved' && (o.status === 'pending_payment' || o.status === 'cancelled')) {
      return this.orders.setStatus(o.id, 'paid', 'Mercado Pago', { message: `Pago aprobado en Mercado Pago (#${p.id}) · $${p.transaction_amount.toLocaleString('es-AR')}` });
    }
    if ((p.status === 'refunded' || p.status === 'charged_back') && o.status !== 'cancelled') {
      return this.orders.setStatus(o.id, 'cancelled', 'Mercado Pago', { message: `Pago ${p.status} en Mercado Pago (#${p.id})` });
    }
    if (p.status === 'rejected' || p.status === 'in_process' || p.status === 'pending') {
      await db.insert(schema.orderEvents).values({ orderId: o.id, type: 'mp', message: `Mercado Pago: ${p.status} (${p.status_detail})`, by: 'Mercado Pago' });
    }
    return this.orders.byNumber(o.number);
  }
}
