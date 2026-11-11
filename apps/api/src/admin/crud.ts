import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, Type, NotFoundException } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { ZodType } from 'zod';
import { db } from '../db/db';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { parse, intId } from '../common/zod';
import { RevalidateService } from '../common/revalidate.service';
import { ActivityService } from '../common/activity.service';
import { z } from 'zod';

type AnyTable = PgTable & { id: PgColumn; sortOrder?: PgColumn };

/** Controlador CRUD genérico para las tablas simples del panel. */
export function makeCrud(opts: {
  path: string; table: AnyTable; create: ZodType; update: ZodType; tags: string[]; label: (row: Record<string, unknown>) => string;
  roles?: AuthUser['role'][]; entity: string; orderBy?: PgColumn;
}): Type<unknown> {
  @Controller(`admin/${opts.path}`)
  @UseGuards(AuthGuard)
  @Roles(...(opts.roles ?? ['admin', 'editor']))
  class CrudController {
    constructor(public reval: RevalidateService, public act: ActivityService) {}

    @Get()
    list() {
      const t = opts.table as AnyTable;
      const order = opts.orderBy ?? t.sortOrder ?? t.id;
      return db.select().from(t as PgTable).orderBy(asc(order), asc(t.id));
    }

    @Get(':id')
    async get(@Param('id') id: string) {
      const [row] = await db.select().from(opts.table as PgTable).where(eq(opts.table.id, parse(intId, id)));
      if (!row) throw new NotFoundException();
      return row;
    }

    @Post()
    async create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
      const data = parse(opts.create, body) as Record<string, unknown>;
      const [row] = await db.insert(opts.table as PgTable).values(data as never).returning();
      await this.act.log(user, 'create', opts.entity, (row as { id: number }).id, `Creó ${opts.label(row as Record<string, unknown>)}`);
      await this.reval.tags(...opts.tags);
      return row;
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
      const data = parse(opts.update, body) as Record<string, unknown>;
      const [row] = await db.update(opts.table as PgTable).set(data as never).where(eq(opts.table.id, parse(intId, id))).returning();
      if (!row) throw new NotFoundException();
      await this.act.log(user, 'update', opts.entity, (row as { id: number }).id, `Editó ${opts.label(row as Record<string, unknown>)}`);
      await this.reval.tags(...opts.tags);
      return row;
    }

    @Put('order')
    async reorder(@Body() body: unknown) {
      const ids = parse(z.object({ ids: z.array(z.number().int()) }), body).ids;
      if (!opts.table.sortOrder) return { ok: false };
      await db.transaction(async (tx) => {
        for (let i = 0; i < ids.length; i++) await tx.update(opts.table as PgTable).set({ sortOrder: i } as never).where(eq(opts.table.id, ids[i]));
      });
      await this.reval.tags(...opts.tags);
      return { ok: true };
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
      const [row] = await db.delete(opts.table as PgTable).where(eq(opts.table.id, parse(intId, id))).returning();
      if (row) await this.act.log(user, 'delete', opts.entity, (row as { id: number }).id, `Eliminó ${opts.label(row as Record<string, unknown>)}`);
      await this.reval.tags(...opts.tags);
      return { ok: true };
    }
  }
  Object.defineProperty(CrudController, 'name', { value: `Crud_${opts.path.replace(/\W/g, '_')}` });
  return CrudController;
}

export const bulkIn = inArray;
