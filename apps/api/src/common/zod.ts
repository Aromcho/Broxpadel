import { BadRequestException } from '@nestjs/common';
import { z, ZodType } from 'zod';

export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(' · ');
    throw new BadRequestException(msg);
  }
  return r.data;
}
export const intId = z.coerce.number().int().positive();
export const optStr = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => (v === '' ? null : v ?? null));
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150);
