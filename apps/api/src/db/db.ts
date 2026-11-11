import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
export const db = drizzle(pool, { schema });
export type DB = NodePgDatabase<typeof schema>;
export { schema };
