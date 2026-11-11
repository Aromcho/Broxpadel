import 'dotenv/config';
import { join, resolve } from 'path';

const root = resolve(__dirname, '..'); // apps/api

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://brox:brox@localhost:5433/broxpadel',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  cookieName: 'brox_admin',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  webInternalUrl: (process.env.WEB_INTERNAL_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, ''),
  revalidateSecret: process.env.REVALIDATE_SECRET ?? 'dev-revalidate',
  storageDir: resolve(process.env.STORAGE_DIR ?? join(root, 'storage')),
  mp: {
    apiBase: (process.env.MP_API_BASE ?? 'https://api.mercadopago.com').replace(/\/$/, ''),
    accessToken: process.env.MP_ACCESS_TOKEN ?? '',
    publicKey: process.env.MP_PUBLIC_KEY ?? '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? '',
    // en local MP no puede llegar al webhook; se puede apuntar a un túnel (ngrok, cloudflared)
    notificationUrl: process.env.MP_NOTIFICATION_URL ?? '',
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Brox Padel <no-reply@broxpadel.com>',
    notify: process.env.MAIL_NOTIFY ?? '',
  },
  pendingOrderTtlHours: Number(process.env.PENDING_ORDER_TTL_HOURS ?? 48),
};
export const mediaDir = join(config.storageDir, 'media');
