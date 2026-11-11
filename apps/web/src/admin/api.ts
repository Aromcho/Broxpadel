'use client';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const r = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (r.status === 401 && !path.startsWith('/auth/')) {
    window.location.href = `/admin/login?next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError(401, 'Sesión vencida');
  }
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new ApiError(r.status, (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) || 'Error');
  return data as T;
}
export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
export const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Pendiente de pago', tone: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Pagado', tone: 'bg-emerald-100 text-emerald-900' },
  preparing: { label: 'Preparando', tone: 'bg-sky-100 text-sky-900' },
  shipped: { label: 'Enviado', tone: 'bg-indigo-100 text-indigo-900' },
  delivered: { label: 'Entregado', tone: 'bg-zinc-200 text-zinc-800' },
  cancelled: { label: 'Cancelado', tone: 'bg-red-100 text-red-900' },
};
export const METHOD: Record<string, string> = { mercadopago: 'Mercado Pago', transfer: 'Transferencia', whatsapp: 'WhatsApp' };
