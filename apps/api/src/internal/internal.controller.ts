import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { InternalGuard } from './internal.guard';
import { UpcomingItem, baDay, baLocal, bump, emptySeries, parseLimit, parseRange, sortUpcoming, totalsOf } from './internal.util';

/**
 * Módulo /internal de Brox Padel (panel central). Solo lectura.
 * Contrato: GET /api/internal/health · /api/internal/metrics?desde=&hasta= · /api/internal/upcoming?limite=
 * Contrato completo y cómo sumar un proyecto: README del repo panel-dios.
 *
 * Hacia el panel salen cantidades, montos, estados y números de pedido: no datos de clientes.
 */
const { orders, coupons } = schema;
const SERVICE = 'brox';
const { version } = require('../../package.json') as { version: string };

/** Contadores de la serie diaria. «ingresos» suma en pesos los pedidos pagados, el día en que se pagaron. */
const COUNTERS = ['pedidos', 'pedidosPagados', 'ingresos'] as const;
/** Qué contadores propios alimentan cada contador común del panel */
const COMMON = { publicaciones: [], consultas: [], ventas: ['pedidosPagados'], visitas: [] };
// Mismo criterio que el dashboard del panel de la tienda (admin/dashboard)
const PAID = ['paid', 'preparing', 'shipped', 'delivered'] as const;
const OPEN = ['pending_payment', 'paid', 'preparing'] as const;
const STATUS_LABEL: Record<string, string> = { pending_payment: 'esperando el pago', paid: 'pagado, falta preparar', preparing: 'en preparación' };

@SkipThrottle()
@Controller('internal')
@UseGuards(InternalGuard)
export class InternalController {
  @Get('health')
  async health() {
    let state: 'up' | 'down' = 'up';
    try {
      await db.execute(sql`select 1`);
    } catch {
      state = 'down';
    }
    return { ok: state === 'up', service: SERVICE, version, uptime: Math.round(process.uptime()), db: state, now: new Date().toISOString() };
  }

  @Get('metrics')
  async metrics(@Query() query: Record<string, unknown>) {
    const range = parseRange(query);
    const [creados, pagados] = await Promise.all([
      db
        .select({ createdAt: orders.createdAt, status: orders.status })
        .from(orders)
        .where(and(gte(orders.createdAt, range.from), lt(orders.createdAt, range.to))),
      // Fecha de cobro: paidAt, o la de creación si el pedido se marcó pagado a mano sin fecha
      db
        .select({ at: sql<Date>`coalesce(${orders.paidAt}, ${orders.createdAt})`, total: orders.total })
        .from(orders)
        .where(and(
          inArray(orders.status, [...PAID]),
          sql`coalesce(${orders.paidAt}, ${orders.createdAt}) >= ${range.from.toISOString()}`,
          sql`coalesce(${orders.paidAt}, ${orders.createdAt}) < ${range.to.toISOString()}`,
        )),
    ]);

    const series = emptySeries(range, COUNTERS);
    const pedidosPorEstado: Record<string, number> = {};
    for (const o of creados) {
      pedidosPorEstado[o.status] = (pedidosPorEstado[o.status] ?? 0) + 1;
      if (o.status !== 'cancelled') bump(series, baDay(o.createdAt), 'pedidos');
    }
    for (const o of pagados) {
      const day = baDay(new Date(o.at));
      bump(series, day, 'pedidosPagados');
      bump(series, day, 'ingresos', o.total);
    }
    const totals = totalsOf(series, COUNTERS);

    return {
      service: SERVICE,
      desde: range.desde,
      hasta: range.hasta,
      totals: { ...totals, pedidosPorEstado, ticketPromedio: totals.pedidosPagados ? Math.round(totals.ingresos / totals.pedidosPagados) : 0 },
      common: COMMON,
      series: [...series.values()],
      byProperty: [],
    };
  }

  @Get('upcoming')
  async upcoming(@Query() query: Record<string, unknown>) {
    const limite = parseLimit(query);
    const [abiertos, cupones] = await Promise.all([
      db
        .select({ number: orders.number, status: orders.status, createdAt: orders.createdAt })
        .from(orders)
        .where(inArray(orders.status, [...OPEN]))
        .orderBy(asc(orders.createdAt))
        .limit(limite),
      db
        .select({ code: coupons.code, endsAt: coupons.endsAt })
        .from(coupons)
        .where(and(eq(coupons.active, true), gte(coupons.endsAt, new Date())))
        .orderBy(asc(coupons.endsAt))
        .limit(limite),
    ]);

    const items: UpcomingItem[] = [
      ...cupones.map((c) => ({
        kind: 'cupon',
        title: `Vence el cupón ${c.code}`,
        date: baLocal(c.endsAt!),
        pending: false,
        who: '',
        status: 'activo',
        propertyId: null,
        ref: c.code,
      })),
      ...abiertos.map((o) => ({
        kind: 'pedido',
        title: `Pedido ${o.number}`,
        date: baLocal(o.createdAt),
        pending: true,
        who: '',
        status: STATUS_LABEL[o.status] ?? o.status,
        propertyId: null,
        ref: o.number,
      })),
    ];
    return { service: SERVICE, generatedAt: new Date().toISOString(), items: sortUpcoming(items) };
  }
}
