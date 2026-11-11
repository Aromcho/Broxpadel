import {
  pgTable, serial, integer, text, varchar, boolean, timestamp, jsonb, pgEnum, primaryKey, index, uniqueIndex, real,
} from 'drizzle-orm/pg-core';

/* ───────── enums ───────── */
export const roleEnum = pgEnum('role', ['admin', 'editor']);
export const mediaKindEnum = pgEnum('media_kind', ['image', 'video', 'model', 'usdz']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['mercadopago', 'transfer', 'whatsapp']);
export const couponTypeEnum = pgEnum('coupon_type', ['percent', 'fixed', 'free_shipping']);
export const shippingTypeEnum = pgEnum('shipping_type', ['pickup', 'zone']);

/* ───────── users ───────── */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 160 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('editor'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

/* ───────── media library ───────── */
export type ImageVariant = { w: number; h: number; url: string };
export type VideoSources = {
  mp4_720?: string; mp4_1080?: string; webm_720?: string; webm_1080?: string;
  v_mp4?: string; v_webm?: string; h_mp4?: string; h_webm?: string; // 9:16 / 16:9 crops
};
export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  kind: mediaKindEnum('kind').notNull(),
  title: varchar('title', { length: 200 }),
  alt: text('alt'),
  originalName: varchar('original_name', { length: 255 }),
  url: text('url').notNull(), // main url (largest webp / mp4 1080 / glb)
  mime: varchar('mime', { length: 80 }),
  size: integer('size'),
  width: integer('width'),
  height: integer('height'),
  duration: real('duration'),
  blur: text('blur'), // data URL tiny placeholder
  dominant: varchar('dominant', { length: 9 }),
  variants: jsonb('variants').$type<ImageVariant[]>(),
  sources: jsonb('sources').$type<VideoSources>(),
  posterId: integer('poster_id'),
  source: varchar('source', { length: 300 }), // where it came from (IG post, Tiendanube, upload)
  tags: jsonb('tags').$type<string[]>().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ───────── business data ───────── */
export const business = pgTable('business', {
  id: integer('id').primaryKey().default(1),
  name: varchar('name', { length: 120 }).notNull(),
  tagline: varchar('tagline', { length: 200 }),
  description: text('description'),
  legalId: varchar('legal_id', { length: 40 }), // CUIT
  whatsapp: varchar('whatsapp', { length: 40 }),
  phone: varchar('phone', { length: 40 }),
  email: varchar('email', { length: 160 }),
  instagram: varchar('instagram', { length: 120 }),
  tiendanube: varchar('tiendanube', { length: 200 }),
  address: varchar('address', { length: 200 }),
  city: varchar('city', { length: 120 }),
  province: varchar('province', { length: 120 }),
  lat: real('lat'),
  lng: real('lng'),
  hasStore: boolean('has_store').notNull().default(false),
  pickupEnabled: boolean('pickup_enabled').notNull().default(false),
  pickupInfo: text('pickup_info'),
  transferDiscountPct: integer('transfer_discount_pct').notNull().default(0),
  transferInfo: text('transfer_info'), // alias / CBU / titular (cargar en el panel)
  installmentsText: varchar('installments_text', { length: 200 }),
  shippingText: varchar('shipping_text', { length: 200 }),
  announcement: varchar('announcement', { length: 200 }),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  logoId: integer('logo_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hours = pgTable('hours', {
  id: serial('id').primaryKey(),
  day: integer('day').notNull(), // 0 domingo … 6 sábado
  open: varchar('open', { length: 5 }).notNull(), // "09:00"
  close: varchar('close', { length: 5 }).notNull(),
  note: varchar('note', { length: 120 }),
});

/* ───────── catalog ───────── */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  coverId: integer('cover_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
});

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  kicker: varchar('kicker', { length: 80 }),
  description: text('description'),
  coverId: integer('cover_id'),
  videoId: integer('video_id'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
});

export const sizeGuides = pgTable('size_guides', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  columns: jsonb('columns').$type<string[]>().notNull().default([]),
  rows: jsonb('rows').$type<string[][]>().notNull().default([]),
  notes: text('notes'),
  imageId: integer('image_id'),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull(),
  subtitle: varchar('subtitle', { length: 200 }),
  description: text('description'),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  price: integer('price').notNull(), // ARS, sin decimales
  compareAtPrice: integer('compare_at_price'),
  family: varchar('family', { length: 80 }), // agrupa colores de un mismo modelo
  colorName: varchar('color_name', { length: 60 }),
  colorHex: varchar('color_hex', { length: 9 }),
  colorHex2: varchar('color_hex2', { length: 9 }), // degradé
  garment: varchar('garment', { length: 20 }).notNull().default('tee'), // tee | shorts | socks
  featured: boolean('featured').notNull().default(false),
  isNew: boolean('is_new').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  modelId: integer('model_id'),
  usdzId: integer('usdz_id'),
  sizeGuideId: integer('size_guide_id'),
  sourceUrl: varchar('source_url', { length: 300 }),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('products_category_idx').on(t.categoryId), index('products_family_idx').on(t.family)]);

export const productMedia = pgTable('product_media', {
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  mediaId: integer('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('gallery'), // front | back | detail | gallery | lifestyle
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.productId, t.mediaId] })]);

export const productCollections = pgTable('product_collections', {
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.productId, t.collectionId] })]);

export const productReels = pgTable('product_reels', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  mediaId: integer('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  igUrl: varchar('ig_url', { length: 300 }),
  caption: varchar('caption', { length: 300 }),
  startAt: real('start_at').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const variants = pgTable('variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  size: varchar('size', { length: 20 }).notNull(),
  sku: varchar('sku', { length: 60 }),
  price: integer('price'), // null = precio del producto
  stock: integer('stock').notNull().default(0),
  lowStock: integer('low_stock').notNull().default(2),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('variants_product_idx').on(t.productId), uniqueIndex('variants_sku_idx').on(t.sku)]);

/* ───────── merchandising ───────── */
export const stories = pgTable('stories', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 60 }).notNull(),
  coverId: integer('cover_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
});
export const storyItems = pgTable('story_items', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  mediaId: integer('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  caption: varchar('caption', { length: 200 }),
  linkLabel: varchar('link_label', { length: 60 }),
  linkHref: varchar('link_href', { length: 300 }),
  duration: real('duration').notNull().default(5),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  placement: varchar('placement', { length: 30 }).notNull().default('promo'), // hero | promo | strip | court
  kicker: varchar('kicker', { length: 80 }),
  title: varchar('title', { length: 160 }).notNull(),
  subtitle: text('subtitle'),
  ctaLabel: varchar('cta_label', { length: 60 }),
  ctaHref: varchar('cta_href', { length: 300 }),
  mediaId: integer('media_id'),
  videoId: integer('video_id'),
  active: boolean('active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  type: couponTypeEnum('type').notNull().default('percent'),
  value: integer('value').notNull().default(0),
  minSubtotal: integer('min_subtotal').notNull().default(0),
  maxUses: integer('max_uses'),
  used: integer('used').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  note: varchar('note', { length: 200 }),
});

export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  type: shippingTypeEnum('type').notNull().default('zone'),
  // rangos de código postal numérico [{from:1000,to:1499}]; vacío = resto del país
  postcodes: jsonb('postcodes').$type<{ from: number; to: number }[]>().notNull().default([]),
  provinces: jsonb('provinces').$type<string[]>().notNull().default([]),
  price: integer('price').notNull().default(0),
  freeFrom: integer('free_from'),
  eta: varchar('eta', { length: 80 }),
  toQuote: boolean('to_quote').notNull().default(false), // costo a coordinar (no se cobra online)
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

/* ───────── orders ───────── */
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 20 }).notNull().unique(),
  token: varchar('token', { length: 40 }).notNull(), // acceso público al estado del pedido
  status: orderStatusEnum('status').notNull().default('pending_payment'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  customerName: varchar('customer_name', { length: 160 }).notNull(),
  customerEmail: varchar('customer_email', { length: 160 }),
  customerPhone: varchar('customer_phone', { length: 40 }),
  shippingZoneId: integer('shipping_zone_id'),
  shippingName: varchar('shipping_name', { length: 120 }),
  address: varchar('address', { length: 200 }),
  city: varchar('city', { length: 120 }),
  province: varchar('province', { length: 120 }),
  postcode: varchar('postcode', { length: 12 }),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  transferDiscount: integer('transfer_discount').notNull().default(0),
  shippingCost: integer('shipping_cost').notNull().default(0),
  shippingToQuote: boolean('shipping_to_quote').notNull().default(false),
  total: integer('total').notNull(),
  couponCode: varchar('coupon_code', { length: 40 }),
  customerNote: text('customer_note'),
  adminNotes: text('admin_notes'),
  trackingCode: varchar('tracking_code', { length: 80 }),
  trackingUrl: varchar('tracking_url', { length: 300 }),
  mpPreferenceId: varchar('mp_preference_id', { length: 120 }),
  mpPaymentId: varchar('mp_payment_id', { length: 60 }),
  mpStatus: varchar('mp_status', { length: 40 }),
  stockRestored: boolean('stock_restored').notNull().default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('orders_status_idx').on(t.status), index('orders_created_idx').on(t.createdAt)]);

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id'),
  variantId: integer('variant_id'),
  name: varchar('name', { length: 160 }).notNull(),
  size: varchar('size', { length: 20 }),
  color: varchar('color', { length: 60 }),
  sku: varchar('sku', { length: 60 }),
  image: text('image'),
  unitPrice: integer('unit_price').notNull(),
  qty: integer('qty').notNull(),
});

export const orderEvents = pgTable('order_events', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 40 }).notNull(),
  message: text('message'),
  by: varchar('by', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activity = pgTable('activity', {
  id: serial('id').primaryKey(),
  userName: varchar('user_name', { length: 120 }),
  action: varchar('action', { length: 40 }).notNull(),
  entity: varchar('entity', { length: 40 }).notNull(),
  entityId: integer('entity_id'),
  summary: varchar('summary', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
