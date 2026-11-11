import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/db';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { parse, intId, optStr } from '../common/zod';
import { MediaService } from '../media/media.service';
import { CatalogService } from '../store/catalog.service';
import { OrdersService } from '../orders/orders.service';
import { RevalidateService } from '../common/revalidate.service';
import { ActivityService } from '../common/activity.service';

/* ───────── biblioteca de medios ───────── */
@Controller('admin/media')
@UseGuards(AuthGuard)
@Roles('admin', 'editor')
export class AdminMediaController {
  constructor(private media: MediaService, private catalog: CatalogService, private reval: RevalidateService, private act: ActivityService) {}

  @Get()
  async list(@Query('kind') kind?: string, @Query('q') q?: string) {
    const conds = [];
    if (kind && ['image', 'video', 'model', 'usdz'].includes(kind)) conds.push(eq(schema.media.kind, kind as 'image'));
    else conds.push(sql`not (${schema.media.tags} ? 'poster')`);
    if (q) conds.push(or(ilike(schema.media.title, `%${q}%`), ilike(schema.media.originalName, `%${q}%`)));
    const rows = await db.select().from(schema.media).where(and(...conds)).orderBy(asc(schema.media.sortOrder), desc(schema.media.id)).limit(500);
    const posters = await this.catalog.mediaMap(rows.map((r) => r.posterId));
    return rows.map((r) => ({ ...r, poster: r.posterId ? this.catalog.img(posters.get(r.posterId)) : null }));
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: diskStorage({ destination: tmpdir() }), limits: { fileSize: 400 * 1024 * 1024 } }))
  async upload(@UploadedFiles() files: Express.Multer.File[], @Body('title') title: string, @CurrentUser() user: AuthUser) {
    if (!files?.length) throw new BadRequestException('No llegó ningún archivo');
    const out = [];
    for (const f of files) {
      try {
        out.push(await this.media.processUpload(f, files.length === 1 ? title : undefined));
      } catch (e) {
        throw new BadRequestException(`${f.originalname}: ${(e as Error).message}`);
      }
    }
    await this.act.log(user, 'upload', 'media', out[0]?.id ?? null, `Subió ${out.length} archivo${out.length > 1 ? 's' : ''} (${out.map((o) => o.kind).join(', ')})`);
    return out;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ title: optStr(200), alt: optStr(500), tags: z.array(z.string().max(30)).max(20).optional() }), body);
    const [r] = await db.update(schema.media).set(b).where(eq(schema.media.id, parse(intId, id))).returning();
    if (!r) throw new NotFoundException();
    await this.reval.tags('products', 'catalog');
    return r;
  }

  @Put('order')
  async reorder(@Body() body: unknown) {
    const ids = parse(z.object({ ids: z.array(z.number().int()) }), body).ids;
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.update(schema.media).set({ sortOrder: i }).where(eq(schema.media.id, ids[i]));
    });
    await this.reval.tags('catalog');
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const mid = parse(intId, id);
    const used = await db.select().from(schema.productMedia).where(eq(schema.productMedia.mediaId, mid)).limit(1);
    if (used.length) throw new BadRequestException('Este archivo está en la galería de un producto: sacalo de ahí primero');
    await this.media.remove(mid);
    await this.act.log(user, 'delete', 'media', mid, 'Eliminó un archivo de la biblioteca');
    await this.reval.tags('catalog', 'products');
    return { ok: true };
  }
}

/* ───────── pedidos ───────── */
const STATUSES = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;

@Controller('admin/orders')
@UseGuards(AuthGuard)
@Roles('admin', 'editor')
export class AdminOrdersController {
  constructor(private orders: OrdersService, private act: ActivityService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('q') q?: string) {
    const conds = [];
    if (status && (STATUSES as readonly string[]).includes(status)) conds.push(eq(schema.orders.status, status as (typeof STATUSES)[number]));
    if (q) conds.push(or(ilike(schema.orders.number, `%${q}%`), ilike(schema.orders.customerName, `%${q}%`), ilike(schema.orders.customerEmail, `%${q}%`), ilike(schema.orders.customerPhone, `%${q}%`)));
    const rows = await db.select().from(schema.orders).where(conds.length ? and(...conds) : undefined).orderBy(desc(schema.orders.createdAt)).limit(300);
    const items = rows.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, rows.map((r) => r.id))) : [];
    const counts = await db.select({ status: schema.orders.status, n: sql<number>`count(*)::int` }).from(schema.orders).groupBy(schema.orders.status);
    return { orders: rows.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) })), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, parse(intId, id)));
    if (!o) throw new NotFoundException();
    const r = await this.orders.byNumber(o.number);
    const [biz] = await db.select().from(schema.business).where(eq(schema.business.id, 1));
    const phone = o.customerPhone?.replace(/\D/g, '') ?? '';
    const waPhone = phone.length === 10 ? `549${phone}` : phone.startsWith('0') ? `549${phone.slice(1)}` : phone;
    return { ...r, replyWhatsapp: waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`¡Hola ${o.customerName.split(' ')[0]}! Te escribimos de ${biz?.name ?? 'Brox Padel'} por tu pedido ${o.number}.`)}` : null };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    const oid = parse(intId, id);
    const b = parse(z.object({ status: z.enum(STATUSES).optional(), adminNotes: optStr(4000), trackingCode: optStr(80), trackingUrl: optStr(300), note: optStr(500) }), body);
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, oid));
    if (!o) throw new NotFoundException();
    if (b.adminNotes !== undefined) await db.update(schema.orders).set({ adminNotes: b.adminNotes, updatedAt: new Date() }).where(eq(schema.orders.id, oid));
    if (b.note) await db.insert(schema.orderEvents).values({ orderId: oid, type: 'note', message: b.note, by: user.name });
    if (b.status || b.trackingCode !== undefined || b.trackingUrl !== undefined) {
      await this.orders.setStatus(oid, b.status ?? o.status, user.name, { trackingCode: b.trackingCode, trackingUrl: b.trackingUrl });
      if (b.status && b.status !== o.status) await this.act.log(user, 'status', 'order', oid, `Pedido ${o.number}: ${b.status}`);
    }
    return this.get(id);
  }
}

/* ───────── dashboard ───────── */
@Controller('admin/dashboard')
@UseGuards(AuthGuard)
export class AdminDashboardController {
  constructor(private catalog: CatalogService) {}

  @Get()
  async stats() {
    const since = new Date(Date.now() - 30 * 864e5);
    const paid = ['paid', 'preparing', 'shipped', 'delivered'] as const;
    const recent = await db.select().from(schema.orders).where(gte(schema.orders.createdAt, since)).orderBy(desc(schema.orders.createdAt));
    const items = recent.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, recent.map((o) => o.id))) : [];
    const ok = recent.filter((o) => (paid as readonly string[]).includes(o.status));
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = day(new Date(Date.now() - (29 - i) * 864e5));
      const os = ok.filter((o) => day(o.paidAt ?? o.createdAt) === d);
      return { day: d, total: os.reduce((a, o) => a + o.total, 0), orders: os.length };
    });
    const sum = (days: number) => ok.filter((o) => +(o.paidAt ?? o.createdAt) >= Date.now() - days * 864e5).reduce((a, o) => a + o.total, 0);
    const top = new Map<string, { name: string; qty: number; total: number }>();
    for (const i of items.filter((i) => ok.some((o) => o.id === i.orderId))) {
      const t = top.get(i.name) ?? { name: i.name, qty: 0, total: 0 };
      t.qty += i.qty; t.total += i.qty * i.unitPrice; top.set(i.name, t);
    }
    const counts = await db.select({ status: schema.orders.status, n: sql<number>`count(*)::int` }).from(schema.orders).groupBy(schema.orders.status);
    const products = await this.catalog.products({ includeHidden: true });
    const lowStock = products.flatMap((p) => p.variants.filter((v) => v.active && v.stock <= v.lowStock).map((v) => ({ productId: p.id, name: p.name, size: v.size, stock: v.stock, image: p.images[0]?.variants?.[0]?.url ?? null })));
    const activity = await db.select().from(schema.activity).orderBy(desc(schema.activity.createdAt)).limit(25);
    return {
      sales: { today: sum(1), week: sum(7), month: sum(30), ordersMonth: ok.length, avgTicket: ok.length ? Math.round(sum(30) / ok.length) : 0 },
      series, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
      top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      lowStock, activity,
      catalog: { products: products.length, visible: products.filter((p) => p.visible).length, with3d: products.filter((p) => p.model).length },
      pending: recent.filter((o) => o.status === 'pending_payment' || o.status === 'paid').slice(0, 8),
    };
  }
}

/* ───────── datos del negocio + horarios ───────── */
const businessBody = z.object({
  name: z.string().trim().min(1).max(120), tagline: optStr(200), description: optStr(4000), legalId: optStr(40),
  whatsapp: optStr(40), phone: optStr(40), email: optStr(160), instagram: optStr(120), tiendanube: optStr(200),
  address: optStr(200), city: optStr(120), province: optStr(120), lat: z.number().nullable().optional(), lng: z.number().nullable().optional(),
  hasStore: z.boolean().optional(), pickupEnabled: z.boolean().optional(), pickupInfo: optStr(1000),
  transferDiscountPct: z.number().int().min(0).max(50).optional(), transferInfo: optStr(1000), installmentsText: optStr(200), shippingText: optStr(200),
  announcement: optStr(200), seoTitle: optStr(200), seoDescription: optStr(500), logoId: z.number().int().positive().nullable().optional(),
});

@Controller('admin/business')
@UseGuards(AuthGuard)
export class AdminBusinessController {
  constructor(private reval: RevalidateService, private act: ActivityService) {}

  @Get()
  async get() {
    const [b] = await db.select().from(schema.business).where(eq(schema.business.id, 1));
    const hours = await db.select().from(schema.hours).orderBy(asc(schema.hours.day), asc(schema.hours.open));
    return { business: b, hours };
  }

  @Patch()
  @Roles('admin')
  async update(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const b = parse(businessBody.partial(), body);
    await db.update(schema.business).set({ ...b, updatedAt: new Date() }).where(eq(schema.business.id, 1));
    await this.act.log(user, 'update', 'business', 1, 'Actualizó los datos del negocio');
    await this.reval.tags('catalog', 'products');
    return this.get();
  }

  @Put('hours')
  @Roles('admin')
  async hours(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const rows = parse(z.object({ hours: z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), note: optStr(120) })).max(28) }), body).hours;
    await db.transaction(async (tx) => {
      await tx.delete(schema.hours);
      if (rows.length) await tx.insert(schema.hours).values(rows);
    });
    await this.act.log(user, 'update', 'hours', null, 'Actualizó los horarios');
    await this.reval.tags('catalog');
    return this.get();
  }
}

/* ───────── usuarios ───────── */
@Controller('admin/users')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private act: ActivityService) {}
  @Get()
  list() {
    return db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, active: schema.users.active, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).orderBy(asc(schema.users.id));
  }
  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    const b = parse(z.object({ email: z.string().email(), name: z.string().trim().min(1).max(120), role: z.enum(['admin', 'editor']), password: z.string().min(8, 'Mínimo 8 caracteres') }), body);
    const [u] = await db.insert(schema.users).values({ email: b.email.toLowerCase(), name: b.name, role: b.role, passwordHash: await bcrypt.hash(b.password, 10) }).returning({ id: schema.users.id });
    await this.act.log(user, 'create', 'user', u.id, `Creó el usuario ${b.email} (${b.role})`);
    return { id: u.id };
  }
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120).optional(), role: z.enum(['admin', 'editor']).optional(), active: z.boolean().optional(), password: z.string().min(8).optional() }), body);
    const uid = parse(intId, id);
    if (uid === user.id && (b.role === 'editor' || b.active === false)) throw new BadRequestException('No podés quitarte el rol de admin a vos mismo');
    const { password, ...rest } = b;
    await db.update(schema.users).set({ ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) }).where(eq(schema.users.id, uid));
    return { ok: true };
  }
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const uid = parse(intId, id);
    if (uid === user.id) throw new BadRequestException('No podés borrarte a vos mismo');
    await db.delete(schema.users).where(eq(schema.users.id, uid));
    return { ok: true };
  }
}
