import { BadRequestException } from '@nestjs/common';

/**
 * Helpers del módulo /internal (panel central). Este archivo es igual en todos los backends
 * NestJS: si lo cambiás en uno, copialo a los demás.
 *
 * Las fechas del contrato son días de Buenos Aires (YYYY-MM-DD). Argentina no tiene horario de
 * verano: UTC-3 fijo.
 */
const BA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

export interface Range {
  desde: string;
  hasta: string;
  /** Día siguiente a `hasta`: tope exclusivo para campos guardados como texto */
  hastaNext: string;
  days: number;
  from: Date;
  to: Date;
}

export interface UpcomingItem {
  kind: string;
  title: string;
  /** Hora de Buenos Aires sin zona: YYYY-MM-DDTHH:mm, o YYYY-MM-DD si es de todo el día */
  date: string;
  /** true = pendiente sin fecha futura (va al final de la lista) */
  pending: boolean;
  who: string;
  status: string;
  propertyId: string | null;
  ref: string;
}

export type SeriesRow<K extends string> = { date: string } & Record<K, number>;

const isYmd = (s: unknown): s is string =>
  typeof s === 'string' && YMD.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Día de Buenos Aires (YYYY-MM-DD) de una fecha */
export const baDay = (d: Date | number | string) => new Date(new Date(d).getTime() - BA_OFFSET_MS).toISOString().slice(0, 10);
/** Fecha y hora de Buenos Aires sin zona (YYYY-MM-DDTHH:mm) */
export const baLocal = (d: Date | number | string) => new Date(new Date(d).getTime() - BA_OFFSET_MS).toISOString().slice(0, 16);
export const today = () => baDay(Date.now());
export const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** Medianoche de Buenos Aires de un día, como Date */
export const baMidnight = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`);

/** ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD, los dos inclusive. Sin parámetros: los últimos 30 días. */
export function parseRange(query: Record<string, unknown> = {}): Range {
  if (query.desde !== undefined && !isYmd(query.desde)) throw new BadRequestException('desde tiene que ser una fecha YYYY-MM-DD');
  if (query.hasta !== undefined && !isYmd(query.hasta)) throw new BadRequestException('hasta tiene que ser una fecha YYYY-MM-DD');
  const hasta = (query.hasta as string | undefined) || today();
  const desde = (query.desde as string | undefined) || addDays(hasta, -(DEFAULT_RANGE_DAYS - 1));
  if (desde > hasta) throw new BadRequestException('desde no puede ser posterior a hasta');
  const days = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) throw new BadRequestException(`El rango máximo es de ${MAX_RANGE_DAYS} días`);
  const hastaNext = addDays(hasta, 1);
  return { desde, hasta, hastaNext, days, from: baMidnight(desde), to: baMidnight(hastaNext) };
}

export function parseLimit(query: Record<string, unknown> = {}, fallback = 20, max = 100) {
  const n = parseInt(String(query.limite ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

/** Serie diaria: una fila por día del rango, con todos los contadores en 0 */
export function emptySeries<K extends string>(range: Range, counters: readonly K[]) {
  const series = new Map<string, SeriesRow<K>>();
  for (let day = range.desde; day <= range.hasta; day = addDays(day, 1)) {
    const row = { date: day } as SeriesRow<K>;
    counters.forEach((c) => ((row as Record<K, number>)[c] = 0));
    series.set(day, row);
  }
  return series;
}

export function bump<K extends string>(series: Map<string, SeriesRow<K>>, day: string, counter: K, n = 1) {
  const row = series.get(day) as Record<K, number> | undefined;
  if (row) row[counter] += n;
}

export function totalsOf<K extends string>(series: Map<string, SeriesRow<K>>, counters: readonly K[]) {
  const totals = {} as Record<K, number>;
  counters.forEach((c) => (totals[c] = 0));
  for (const row of series.values()) counters.forEach((c) => (totals[c] += (row as Record<K, number>)[c]));
  return totals;
}

/** Orden de «upcoming»: primero lo que tiene fecha, de más cerca a más lejos; después los pendientes */
export function sortUpcoming(items: UpcomingItem[]) {
  return [...items].sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? 1 : -1;
    return a.date.localeCompare(b.date);
  });
}
