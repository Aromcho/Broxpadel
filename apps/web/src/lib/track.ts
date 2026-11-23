'use client';
/**
 * Píxel de Meta + Google Analytics 4.
 * Cada evento sale del navegador (fbq / gtag) y, los del embudo, también desde el servidor
 * por la API de conversiones (/api/track) con el mismo event_id: Meta los junta y no los cuenta dos veces.
 */
import { META_PIXEL_ID, GA4_ID, TRACKING_ON } from './tracking-ids';

type FbqFn = (...args: unknown[]) => void;
type GtagFn = (...args: unknown[]) => void;
declare global {
  interface Window { fbq?: FbqFn; gtag?: GtagFn; dataLayer?: unknown[] }
}

export type TrackItem = { id: number | string; name: string; price: number; qty: number; size?: string | null; color?: string | null; category?: string | null };
export type TrackEvent = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase' | 'Contact';

const GA_NAME: Record<TrackEvent, string> = {
  ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout',
  AddPaymentInfo: 'add_payment_info', Purchase: 'purchase', Contact: 'generate_lead',
};
/** Los que el servidor reenvía (la compra y el pedido los manda el servidor por su cuenta). */
const SERVER: TrackEvent[] = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Contact'];

const cookie = (k: string) => (typeof document === 'undefined' ? null : document.cookie.split('; ').find((c) => c.startsWith(k + '='))?.split('=').slice(1).join('=') ?? null);
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** _fbc: la cookie del píxel o, si todavía no está, armada con el fbclid del anuncio. */
function fbc() {
  const c = cookie('_fbc');
  if (c) return c;
  try {
    const id = new URLSearchParams(location.search).get('fbclid') ?? sessionStorage.getItem('brox_fbclid');
    if (!id) return null;
    sessionStorage.setItem('brox_fbclid', id);
    return `fb.1.${Date.now()}.${id}`;
  } catch { return null; }
}
/** ID de cliente de Analytics (cookie _ga = GA1.1.<id>). */
function gaClientId() {
  const c = cookie('_ga');
  return c ? c.split('.').slice(-2).join('.') : null;
}

/** Datos del navegador que el checkout manda junto con el pedido. */
export function trackingContext() {
  if (!TRACKING_ON) return {};
  return { fbp: cookie('_fbp'), fbc: fbc(), gaClientId: gaClientId(), url: location.href };
}

export function track(name: TrackEvent, p: { items: TrackItem[]; value?: number; eventId?: string; orderNumber?: string; paymentMethod?: string }) {
  if (!TRACKING_ON) return;
  const eventId = p.eventId ?? `${name}-${uid()}`;
  const value = Math.round(p.value ?? p.items.reduce((a, i) => a + i.price * i.qty, 0));
  const contentIds = [...new Set(p.items.map((i) => String(i.id)))];
  const contents = p.items.map((i) => ({ id: String(i.id), quantity: i.qty, item_price: i.price }));
  const numItems = p.items.reduce((a, i) => a + i.qty, 0);
  try {
    window.fbq?.('track', name, {
      currency: 'ARS', value, content_type: 'product', content_ids: contentIds, contents, num_items: numItems,
      ...(p.items.length === 1 ? { content_name: p.items[0].name } : {}),
      ...(p.orderNumber ? { order_id: p.orderNumber } : {}),
    }, { eventID: eventId });
  } catch { /* sin píxel */ }
  try {
    window.gtag?.('event', GA_NAME[name], {
      currency: 'ARS', value,
      ...(p.orderNumber ? { transaction_id: p.orderNumber } : {}),
      ...(p.paymentMethod ? { payment_type: p.paymentMethod } : {}),
      items: p.items.map((i) => ({ item_id: String(i.id), item_name: i.name, item_brand: 'BROX', item_category: i.category ?? undefined, item_variant: [i.color, i.size].filter(Boolean).join(' · ') || undefined, price: i.price, quantity: i.qty })),
    });
  } catch { /* sin Analytics */ }
  if (SERVER.includes(name) && META_PIXEL_ID) {
    const body = JSON.stringify({
      event: name, eventId, url: location.href, fbp: cookie('_fbp'), fbc: fbc(),
      data: { value, contentIds, contents, numItems, ...(p.items.length === 1 ? { contentName: p.items[0].name } : {}) },
    });
    fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  }
}

/** Compra vista en el navegador (vuelta de Mercado Pago o pedido ya pagado): una sola vez por pedido en este navegador. */
export function trackPurchaseOnce(orderNumber: string, items: TrackItem[], value: number, paymentMethod: string) {
  if (!TRACKING_ON) return;
  const k = `brox_purchase_${orderNumber}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* modo privado */ }
  track('Purchase', { items, value, orderNumber, paymentMethod, eventId: `purchase-${orderNumber}` });
}

export { META_PIXEL_ID, GA4_ID };

/** Evento propio (p. ej. clic a Mercado Libre): solo navegador. */
export function trackCustom(name: string, params: Record<string, unknown> = {}) {
  if (!TRACKING_ON) return;
  try { window.fbq?.('trackCustom', name, params); } catch { /* sin píxel */ }
  try { window.gtag?.('event', name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(), params); } catch { /* sin Analytics */ }
}
