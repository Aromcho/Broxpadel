import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { config } from '../config';

type Order = typeof schema.orders.$inferSelect;
type OrderItem = typeof schema.orderItems.$inferSelect;

/** Lo que manda el navegador para cruzar el evento con la persona (cookies del píxel y de Analytics). */
export type BrowserCtx = { fbp?: string | null; fbc?: string | null; gaClientId?: string | null; url?: string | null; ip?: string | null; ua?: string | null };
export type EventItem = { id: string; quantity: number; item_price?: number };
export type EventData = { value?: number; contentIds?: string[]; contents?: EventItem[]; numItems?: number; contentName?: string };

export const BROWSER_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Contact'] as const;
const PAID = ['paid', 'preparing', 'shipped', 'delivered'];

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const clean = (v: string | null | undefined) => (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const hashed = (v: string | null | undefined) => (clean(v) ? [sha(clean(v))] : undefined);
/** Teléfono con código de país (Argentina = 54), solo dígitos. */
function phoneAr(v: string | null | undefined) {
  let d = (v ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return undefined;
  if (!d.startsWith('54')) d = '54' + d;
  return [sha(d)];
}

/**
 * Píxel de Meta del lado del servidor (API de conversiones) + datos para Analytics.
 * Cada evento lleva el mismo event_id que el del navegador para que Meta no lo cuente dos veces.
 * Sin META_CAPI_TOKEN no manda nada (el píxel del navegador igual funciona).
 */
@Injectable()
export class TrackingService implements OnModuleInit {
  private log = new Logger('Tracking');

  /** Token y código de prueba cargados desde el panel (/admin/medicion); la variable de entorno tiene prioridad. */
  private saved: { token: string; testCode: string } = { token: '', testCode: '' };
  get token() { return config.meta.capiToken || this.saved.token; }
  get testCode() { return config.meta.testEventCode || this.saved.testCode; }
  get tokenSource(): 'env' | 'panel' | null { return config.meta.capiToken ? 'env' : this.saved.token ? 'panel' : null; }
  get enabled() {
    return !!(config.meta.pixelId && this.token);
  }

  private async loadSettings() {
    const r = await db.execute(sql`select key, value from app_settings where key in ('meta_capi_token', 'meta_test_event_code')`);
    const rows = (r as unknown as { rows: { key: string; value: string }[] }).rows ?? [];
    this.saved = { token: rows.find((x) => x.key === 'meta_capi_token')?.value ?? '', testCode: rows.find((x) => x.key === 'meta_test_event_code')?.value ?? '' };
  }
  async saveSetting(key: 'meta_capi_token' | 'meta_test_event_code', value: string) {
    if (value) await db.execute(sql`insert into app_settings (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value, updated_at = now()`);
    else await db.execute(sql`delete from app_settings where key = ${key}`);
    await this.loadSettings();
  }
  /** Prueba un token contra el píxel antes de guardarlo. */
  async checkToken(token: string): Promise<string | null> {
    try {
      const r = await fetch(`https://graph.facebook.com/${config.meta.graphVersion}/${config.meta.pixelId}?fields=id,name&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return null;
      const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
      return j?.error?.message ?? `Meta respondió ${r.status}`;
    } catch (e) {
      return (e as Error).message;
    }
  }

  /** Tabla propia (fuera de las migraciones de Drizzle para no chocar con las del servidor). */
  async onModuleInit() {
    try {
      await db.execute(sql`create table if not exists order_tracking (
        order_id integer primary key references orders(id) on delete cascade,
        fbp varchar(200), fbc varchar(300), ga_client_id varchar(80), ip varchar(64), ua varchar(400), source_url varchar(500),
        purchase_sent_at timestamptz, created_at timestamptz not null default now()
      )`);
      await db.execute(sql`create table if not exists app_settings (key varchar(80) primary key, value text not null, updated_at timestamptz not null default now())`);
      await this.loadSettings();
    } catch (e) {
      this.log.error(`No se pudieron crear las tablas de medición: ${(e as Error).message}`);
    }
  }

  /** Evento que viene del navegador (vista de producto, carrito, checkout, WhatsApp): se reenvía por la API de conversiones. */
  async browserEvent(name: string, eventId: string, ctx: BrowserCtx, data: EventData) {
    if (!(BROWSER_EVENTS as readonly string[]).includes(name)) return;
    await this.send({ event_name: name, event_id: eventId, event_source_url: ctx.url ?? undefined, user_data: this.userData(ctx), custom_data: this.customData(data) });
  }

  /** Pedido creado: guarda las cookies del navegador (para la compra, que llega después) y avisa "AddPaymentInfo". */
  async orderPlaced(order: Order, items: OrderItem[], ctx: BrowserCtx) {
    try {
      await db.execute(sql`insert into order_tracking (order_id, fbp, fbc, ga_client_id, ip, ua, source_url)
        values (${order.id}, ${ctx.fbp?.slice(0, 200) ?? null}, ${ctx.fbc?.slice(0, 300) ?? null}, ${ctx.gaClientId?.slice(0, 80) ?? null},
                ${ctx.ip?.slice(0, 64) ?? null}, ${ctx.ua?.slice(0, 400) ?? null}, ${ctx.url?.slice(0, 500) ?? null})
        on conflict (order_id) do nothing`);
    } catch (e) {
      this.log.warn(`No se guardó el contexto del pedido ${order.number}: ${(e as Error).message}`);
    }
    await this.send({
      event_name: 'AddPaymentInfo', event_id: `pay-${order.number}`, event_source_url: ctx.url ?? `${config.publicUrl}/checkout`,
      user_data: this.userData(ctx, order), custom_data: { ...this.orderData(order, items), payment_method: order.paymentMethod },
    });
  }

  /** Compra: cuando el pedido pasa a pagado (Mercado Pago solo, o a mano en el panel para transferencia y WhatsApp). Una sola vez por pedido. */
  async purchase(order: Order, items: OrderItem[]) {
    if (!PAID.includes(order.status) || !this.enabled) return;
    let ctx: BrowserCtx = {};
    try {
      await db.execute(sql`insert into order_tracking (order_id) values (${order.id}) on conflict (order_id) do nothing`);
      const upd = await db.execute(sql`update order_tracking set purchase_sent_at = now()
        where order_id = ${order.id} and purchase_sent_at is null
        returning fbp, fbc, ga_client_id, ip, ua, source_url`);
      const row = (upd as unknown as { rows: Record<string, string | null>[] }).rows?.[0];
      if (!row) return; // ya se mandó
      ctx = { fbp: row.fbp, fbc: row.fbc, gaClientId: row.ga_client_id, ip: row.ip, ua: row.ua, url: row.source_url };
    } catch (e) {
      this.log.warn(`order_tracking: ${(e as Error).message}`);
    }
    const ok = await this.send({
      event_name: 'Purchase', event_id: `purchase-${order.number}`,
      event_time: Math.floor((order.paidAt ? +order.paidAt : Date.now()) / 1000),
      event_source_url: `${config.publicUrl}/pedido/${order.number}`,
      user_data: this.userData(ctx, order), custom_data: this.orderData(order, items),
    });
    if (ok) await db.insert(schema.orderEvents).values({ orderId: order.id, type: 'tracking', message: 'Compra informada a Meta (píxel)', by: 'sistema' }).catch(() => undefined);
    else await db.execute(sql`update order_tracking set purchase_sent_at = null where order_id = ${order.id}`).catch(() => undefined);
  }

  private userData(ctx: BrowserCtx, order?: Order) {
    const [first, ...rest] = (order?.customerName ?? '').trim().split(/\s+/);
    const u: Record<string, unknown> = {
      client_ip_address: ctx.ip || undefined,
      client_user_agent: ctx.ua || undefined,
      fbp: ctx.fbp || undefined,
      fbc: ctx.fbc || undefined,
    };
    if (order) {
      Object.assign(u, {
        em: hashed(order.customerEmail), ph: phoneAr(order.customerPhone),
        fn: hashed(first), ln: hashed(rest.join(' ')),
        ct: hashed(clean(order.city).replace(/[^a-z]/g, '')), st: hashed(clean(order.province).replace(/[^a-z]/g, '')),
        zp: hashed(order.postcode?.replace(/\s/g, '')), country: [sha('ar')],
        external_id: hashed(order.customerEmail),
      });
    }
    return u;
  }

  private customData(d: EventData) {
    const c: Record<string, unknown> = { currency: 'ARS' };
    if (d.value !== undefined) c.value = Math.round(d.value);
    if (d.contentIds?.length) { c.content_ids = d.contentIds.slice(0, 50); c.content_type = 'product'; }
    if (d.contents?.length) c.contents = d.contents.slice(0, 50);
    if (d.numItems !== undefined) c.num_items = d.numItems;
    if (d.contentName) c.content_name = d.contentName.slice(0, 200);
    return c;
  }

  private orderData(order: Order, items: OrderItem[]) {
    const ids = [...new Set(items.map((i) => String(i.productId ?? i.sku ?? i.name)))];
    return {
      currency: 'ARS', value: order.total, order_id: order.number, content_type: 'product', content_ids: ids,
      contents: items.map((i) => ({ id: String(i.productId ?? i.sku ?? i.name), quantity: i.qty, item_price: i.unitPrice })),
      num_items: items.reduce((a, i) => a + i.qty, 0),
    };
  }

  private async send(ev: Record<string, unknown>): Promise<boolean> {
    if (!this.enabled) return false;
    const body: Record<string, unknown> = {
      data: [{ event_time: Math.floor(Date.now() / 1000), action_source: 'website', ...ev }],
    };
    if (this.testCode) body.test_event_code = this.testCode;
    try {
      const r = await fetch(`https://graph.facebook.com/${config.meta.graphVersion}/${config.meta.pixelId}/events?access_token=${encodeURIComponent(this.token)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        this.log.warn(`Meta ${ev.event_name}: ${r.status} ${(await r.text()).slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.log.warn(`Meta ${ev.event_name}: ${(e as Error).message}`);
      return false;
    }
  }
}
