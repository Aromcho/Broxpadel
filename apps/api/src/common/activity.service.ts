import { Injectable } from '@nestjs/common';
import { db, schema } from '../db/db';

@Injectable()
export class ActivityService {
  async log(user: { name?: string } | undefined, action: string, entity: string, entityId: number | null, summary: string) {
    await db.insert(schema.activity).values({ userName: user?.name ?? 'sistema', action, entity, entityId: entityId ?? null, summary: summary.slice(0, 300) });
  }
}
