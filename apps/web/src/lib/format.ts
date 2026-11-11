export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Variante de imagen más chica que cubre el ancho pedido. */
export function pick(img: { url: string; variants: { w: number; url: string }[] } | null | undefined, w: number) {
  if (!img) return '';
  const v = [...(img.variants ?? [])].sort((a, b) => a.w - b.w).find((x) => x.w >= w);
  return v?.url ?? img.url;
}
export function srcSet(img: { variants: { w: number; url: string }[] } | null | undefined) {
  return (img?.variants ?? []).map((v) => `${v.url} ${v.w}w`).join(', ');
}

/** Abierto ahora (zona horaria de Argentina). */
export function openNow(hours: { day: number; open: string; close: string }[], now = new Date()) {
  const ar = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const d = ar.getDay();
  const mins = ar.getHours() * 60 + ar.getMinutes();
  const toM = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const today = hours.filter((h) => h.day === d);
  const current = today.find((h) => mins >= toM(h.open) && mins < toM(h.close));
  if (current) return { open: true, label: `Abierto ahora · cierra ${current.close} h` };
  const later = today.filter((h) => toM(h.open) > mins).sort((a, b) => toM(a.open) - toM(b.open))[0];
  if (later) return { open: false, label: `Cerrado · abre hoy ${later.open} h` };
  for (let i = 1; i <= 7; i++) {
    const nd = (d + i) % 7;
    const n = hours.filter((h) => h.day === nd).sort((a, b) => toM(a.open) - toM(b.open))[0];
    if (n) return { open: false, label: `Cerrado · abre ${i === 1 ? 'mañana' : DAYS[nd].toLowerCase()} ${n.open} h` };
  }
  return { open: false, label: 'Sin horarios cargados' };
}
