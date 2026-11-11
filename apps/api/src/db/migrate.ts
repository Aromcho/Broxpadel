import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { db, pool } from './db';

(async () => {
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
  console.log('✔ migraciones aplicadas');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
