/**
 * Seed: carga TODO el contenido relevado (Tiendanube + Instagram de @broxpadel, 11/11/2026).
 * Fuente: media/curated (fotos limpias + recortes de reels), media/3d (prendas 3D), media/brand (logo vectorizado).
 * Los archivos procesados quedan en storage/media (si ya existen, no se vuelven a procesar).
 *
 *   npm run db:seed            → solo si la base está vacía
 *   npm run db:seed -- --force → borra el contenido y lo vuelve a cargar
 */
import 'reflect-metadata';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { db, pool, schema } from './db';
import { MediaService } from '../media/media.service';
import { config } from '../config';

const ROOT = resolve(__dirname, '../../../..'); // raíz del monorepo
const CUR = process.env.SEED_MEDIA_DIR ?? join(ROOT, 'media', 'curated');
const M3D = join(ROOT, 'media', '3d');
const BRAND = join(ROOT, 'media', 'brand');
const media = new MediaService();
const force = process.argv.includes('--force');

type Manifest = {
  products: {
    slug: string; tn: string; name: string; category: string; family: string; color: string; garment: 'tee' | 'shorts';
    price: number; description: string; seo: string; sourceUrl: string; featured?: boolean; isNew?: boolean; reels?: string[];
    variants: { size: string; price: number; stock: number | null }[];
    images: { file: string; role: string; origin: string }[];
  }[];
  reels: { key: string; file: string; ig: string; title: string; tags: string[] }[];
};

// colores de muestra para los selectores (tomados a ojo de las fotos reales: arriba / abajo del degradé)
const COLORS: Record<string, [string, string | null]> = {
  'remera-brox-marron-degrade': ['#d3cbc9', '#8c6f63'],
  'remera-brox-blanca': ['#f4f4f2', '#d8d9dc'],
  'remera-brox-violeta': ['#8c2f63', '#6b1f4a'],
  'remera-brox-negra': ['#1d1e22', '#3d3e44'],
  'remera-brox-azul-degrade': ['#2f3f73', '#7ea3d6'],
  'remera-brox-celeste': ['#1fa2c6', '#1c3d58'],
  'remera-brox-rosa-polvo': ['#dcc6ce', '#c7a9b6'],
  'remera-brox-gris-oscuro': ['#4c4d52', '#2e2f33'],
  'remera-brox-retro-gris': ['#3b3c41', '#a9acb0'],
  'remera-brox-retro-roja': ['#2d2e33', '#e5262c'],
  'short-brox-blanco': ['#efefed', null],
  'short-brox-gris-degrade': ['#8e8f94', '#efefef'],
  'short-brox-celeste-degrade': ['#4f6e9c', '#8fb3dc'],
  'short-brox-turquesa-degrade': ['#2c3c48', '#19a7c4'],
  'short-brox-gris-oscuro': ['#4a4b50', null],
};

// características: solo lo que dicen sus propias publicaciones
const FEATURES: Record<string, string[]> = {
  'remeras-secado-rapido': ['Tecnología Dry-Wick: secado ultrarrápido', 'Protección UPF 50+', 'Poliéster ultraliviano y respirable', 'Tela antitranspirante'],
  'remeras-retro': ['Diseño retro BROX', 'Alto rendimiento, pensada para pádel'],
  shorts: ['Tela antitranspirante', 'Secado rápido', 'Liviano'],
};
const SHORT_EXTRA: Record<string, string[]> = {
  'short-brox-blanco': ['Elastizado y ajustable'],
  'short-brox-gris-degrade': ['Elastizado y ajustable'],
  'short-brox-celeste-degrade': ['Ajustable'],
};

const fixText = (s: string) =>
  s.replace(/trasnpirtante|trasnpirante/gi, 'transpirante').replace(/anti transpirante/gi, 'antitranspirante').replace(/elastisado/gi, 'elastizado')
    .replace(/secado rapido/gi, 'secado rápido').replace(/\s+/g, ' ').trim();

function shortDescription(slug: string, raw: string) {
  const t = fixText(raw);
  return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith('.') ? '' : '.');
}

async function main() {
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from products`)).rows as { n: number }[];
  if (n > 0 && !force) {
    console.log('La base ya tiene productos. Usá "npm run db:seed -- --force" para recargar todo.');
    return;
  }
  await db.execute(sql`truncate table order_events, order_items, orders, story_items, stories, banners, coupons, shipping_zones, product_reels, product_collections, product_media, variants, products, size_guides, collections, categories, hours, business, media, activity, users restart identity cascade`);
  const man = JSON.parse(readFileSync(join(CUR, 'manifest.json'), 'utf8')) as Manifest;

  /* usuarios */
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@broxpadel.com').toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'BroxPadel2026!';
  await db.insert(schema.users).values([
    { email: adminEmail, name: 'Admin Brox', role: 'admin', passwordHash: await bcrypt.hash(adminPass, 10) },
    { email: 'editor@broxpadel.com', name: 'Editor Brox', role: 'editor', passwordHash: await bcrypt.hash(process.env.SEED_EDITOR_PASSWORD ?? 'BroxEditor2026!', 10) },
  ]);

  /* logo */
  const logoPng = await sharp(readFileSync(join(BRAND, 'brox-logo.svg')), { density: 300 }).resize({ width: 1600 }).png().toBuffer();
  const logo = await media.processImage(logoPng, { title: 'Logo BROX Padel', alt: 'BROX Padel', source: 'Instagram @broxpadel (vectorizado)', tags: ['brand'] });

  /* negocio */
  await db.insert(schema.business).values({
    id: 1, name: 'Brox Padel', tagline: 'Indumentaria de pádel. Diseño, rendimiento y estilo.',
    description: 'Diseñamos indumentaria de pádel pensada para jugar sin límites: tecnología Dry-Wick de secado ultrarrápido, protección UPF 50+ y poliéster ultraliviano que vas a sentir que no llevás nada puesto. Confort, calidad y precio.',
    legalId: '20-38676046-3', instagram: 'broxpadel', tiendanube: 'https://broxpadel.mitiendanube.com',
    // único teléfono publicado por la marca (inscripciones del Torneo BROX, post del 31/07/2026): confirmalo en el panel
    whatsapp: process.env.SEED_WHATSAPP ?? '5492255409164',
    city: 'Villa Gesell', province: 'Buenos Aires', hasStore: false, pickupEnabled: false,
    transferDiscountPct: 5, transferInfo: null,
    installmentsText: 'Tarjetas de crédito y débito en 1 pago', shippingText: 'Envíos a todo el país',
    announcement: '5% off pagando con transferencia · Envíos a todo el país',
    seoTitle: 'Brox Padel · Indumentaria de pádel', seoDescription: 'Remeras y shorts de pádel BROX con tecnología Dry-Wick y protección UPF 50+. Envíos a todo el país desde Villa Gesell. 5% off con transferencia.',
    logoId: logo.id,
  });

  /* reels → videos procesados */
  const reel = new Map<string, number>();
  for (let i = 0; i < man.reels.length; i++) {
    const r = man.reels[i];
    const v = await media.processVideo(join(CUR, r.file), { title: r.title, source: r.ig, tags: r.tags });
    await db.update(schema.media).set({ sortOrder: i }).where(sql`id = ${v.id}`);
    reel.set(r.key, v.id);
    console.log(`  video ${r.key} ✔`);
  }

  /* categorías */
  const catDefs = [
    { slug: 'remeras-secado-rapido', name: 'Remeras secado rápido', description: 'Tecnología Dry-Wick, protección UPF 50+ y poliéster ultraliviano.', visible: true },
    { slug: 'remeras-retro', name: 'Remeras retro', description: 'Remeras de alto rendimiento, diseñadas exclusivamente para jugadores de pádel.', visible: true },
    { slug: 'shorts', name: 'Shorts', description: 'Shorts antitranspirantes y de secado rápido.', visible: true },
    { slug: 'medias', name: 'Medias reforzadas para pádel', description: null, visible: false },
  ];
  const cats = await db.insert(schema.categories).values(catDefs.map((c, i) => ({ ...c, sortOrder: i }))).returning();
  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;

  /* guía de talles (de la imagen que publican en Tiendanube) */
  const [guide] = await db.insert(schema.sizeGuides).values({
    name: 'Remeras BROX', columns: ['Talle', 'Largo (cm)', 'Medio pecho (cm)'],
    rows: [['XS', '64', '44'], ['S', '67', '47'], ['M', '70', '50'], ['L', '73', '53'], ['XL', '75', '56'], ['XXL', '77', '59'], ['XXXL', '79', '62'], ['4XL', '81', '65'], ['5XL', '83', '68']],
    notes: 'Medidas aproximadas en centímetros: puede haber pequeñas variaciones. Largo: del hombro a la cintura. Medio pecho: de axila a axila, con la remera apoyada. Los talles 2 y 4 son infantiles.',
  }).returning();

  /* colecciones */
  const cols = await db.insert(schema.collections).values([
    { slug: 'nueva-temporada', name: 'Nueva temporada', kicker: 'Recién llegadas', description: 'Las últimas combinaciones de colores BROX.', featured: true, sortOrder: 0, videoId: reel.get('rosa') },
    { slug: 'conjuntos', name: 'Conjuntos BROX', kicker: 'Remera + short', description: 'Las combinaciones que armamos para la cancha: remera y short antitranspirantes.', featured: true, sortOrder: 1, videoId: reel.get('short') },
    { slug: 'torneo-brox', name: 'Lo que se usó en el Torneo BROX', kicker: 'Maxxim Pádel · Villa Gesell', description: 'Las prendas que presentamos en el Torneo BROX, en Maxxim Pádel.', featured: false, sortOrder: 2, videoId: reel.get('torneo-maniqui') },
  ]).returning();
  const colId = (slug: string) => cols.find((c) => c.slug === slug)!.id;
  const COLLECTIONS: Record<string, string[]> = {
    'nueva-temporada': ['remera-brox-rosa-polvo', 'remera-brox-azul-degrade', 'remera-brox-marron-degrade', 'short-brox-gris-degrade', 'remera-brox-violeta'],
    conjuntos: ['remera-brox-marron-degrade', 'remera-brox-blanca', 'short-brox-blanco', 'short-brox-gris-degrade', 'short-brox-celeste-degrade'],
    'torneo-brox': ['remera-brox-violeta', 'remera-brox-celeste', 'short-brox-turquesa-degrade', 'remera-brox-gris-oscuro'],
  };

  /* productos */
  const firstImage = new Map<string, number>();
  for (let i = 0; i < man.products.length; i++) {
    const p = man.products[i];
    const isTee = p.garment === 'tee';
    const desc = isTee && p.category === 'remeras-secado-rapido'
      ? 'Utilizamos tecnología Dry-Wick para asegurar un secado ultrarrápido, porque sabemos que cuando estás definiendo un partido no podés preocuparte por el sudor. Sumamos protección UPF 50+ para esos partidos interminables a plena luz del día. Y la hicimos con un poliéster tan liviano y respirable que te vas a olvidar de que la tenés puesta.'
      : shortDescription(p.slug, p.description);
    let modelId: number | null = null;
    let usdzId: number | null = null;
    const glb = join(M3D, 'optimized', `${p.slug}.glb`);
    if (existsSync(glb)) modelId = (await media.storeModel(glb, { title: `${p.name} (3D)`, source: 'Generado desde las fotos reales' })).id;
    const usdz = join(M3D, 'usdz', `${p.slug}.usdz`);
    if (existsSync(usdz)) usdzId = (await media.storeUsdz(usdz, { title: `${p.name} (AR iPhone)` })).id;
    const [prod] = await db.insert(schema.products).values({
      slug: p.slug, name: p.name, subtitle: p.color, description: desc,
      features: [...(FEATURES[p.category] ?? []), ...(SHORT_EXTRA[p.slug] ?? [])],
      categoryId: catId(p.category), price: p.price, family: p.family, colorName: p.color,
      colorHex: COLORS[p.slug]?.[0] ?? null, colorHex2: COLORS[p.slug]?.[1] ?? null,
      garment: p.garment, featured: !!p.featured, isNew: !!p.isNew, visible: true, sortOrder: i,
      modelId, usdzId, sizeGuideId: isTee ? guide.id : null, sourceUrl: p.sourceUrl,
      seoTitle: `${p.name} · Brox Padel`, seoDescription: fixText(p.seo).slice(0, 300),
    }).returning();
    // fotos
    const rows: { productId: number; mediaId: number; role: string; sortOrder: number }[] = [];
    for (let k = 0; k < p.images.length; k++) {
      const im = p.images[k];
      const m = await media.processImage(join(CUR, im.file), { title: `${p.name} · ${im.role}`, alt: `${p.name}${im.role === 'back' ? ' (espalda)' : im.role === 'detail' ? ' (detalle)' : ''}`, source: im.origin, tags: ['product'] });
      rows.push({ productId: prod.id, mediaId: m.id, role: im.role, sortOrder: k });
      if (k === 0) firstImage.set(p.slug, m.id);
    }
    await db.insert(schema.productMedia).values(rows);
    // talles (Tiendanube no controla stock salvo en una prenda: se carga stock inicial editable en el panel)
    const KIDS = new Set(['2', '4']);
    const vs = [...p.variants].sort((a, b) => {
      const order = ['2', '4', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Único'];
      return order.indexOf(a.size) - order.indexOf(b.size);
    });
    await db.insert(schema.variants).values(vs.map((v, k) => ({
      productId: prod.id, size: v.size, sku: `BRX-${String(prod.id).padStart(3, '0')}-${v.size.replace(/\W/g, '').toUpperCase() || 'U'}`,
      price: v.price === p.price ? null : v.price, stock: v.stock ?? 10, lowStock: KIDS.has(v.size) ? 1 : 2, active: true, sortOrder: k,
    })));
    // reels "En acción"
    if (p.reels?.length) {
      await db.insert(schema.productReels).values(p.reels.map((k, j) => ({
        productId: prod.id, mediaId: reel.get(k)!, igUrl: man.reels.find((r) => r.key === k)!.ig, caption: man.reels.find((r) => r.key === k)!.title, sortOrder: j,
      })));
    }
    for (const [slug, list] of Object.entries(COLLECTIONS)) {
      if (list.includes(p.slug)) await db.insert(schema.productCollections).values({ productId: prod.id, collectionId: colId(slug), sortOrder: list.indexOf(p.slug) });
    }
    console.log(`  ${p.name} ✔ (${p.images.length} fotos${modelId ? ', 3D' : ''}${usdzId ? ', AR' : ''})`);
  }

  // portadas de categorías y colecciones
  const cover = (slug: string) => firstImage.get(slug) ?? null;
  await db.update(schema.categories).set({ coverId: cover('remera-brox-violeta') }).where(sql`slug = 'remeras-secado-rapido'`);
  await db.update(schema.categories).set({ coverId: cover('remera-brox-retro-roja') }).where(sql`slug = 'remeras-retro'`);
  await db.update(schema.categories).set({ coverId: cover('short-brox-celeste-degrade') }).where(sql`slug = 'shorts'`);
  await db.update(schema.collections).set({ coverId: cover('remera-brox-rosa-polvo') }).where(sql`slug = 'nueva-temporada'`);
  await db.update(schema.collections).set({ coverId: cover('short-brox-blanco') }).where(sql`slug = 'conjuntos'`);
  await db.update(schema.collections).set({ coverId: cover('remera-brox-violeta') }).where(sql`slug = 'torneo-brox'`);

  /* historias destacadas (como en su IG: Torneo BROX II, Remeras, Short) */
  const pm = async (slug: string, idx = 0) => {
    const rows = await db.execute(sql`select pm.media_id from product_media pm join products p on p.id = pm.product_id where p.slug = ${slug} order by pm.sort_order limit 1 offset ${idx}`);
    return (rows.rows[0] as { media_id: number } | undefined)?.media_id;
  };
  const st = await db.insert(schema.stories).values([
    { title: 'Torneo BROX II', coverId: await pm('remera-brox-violeta', 0), sortOrder: 0 },
    { title: 'Remeras', coverId: await pm('remera-brox-marron-degrade', 0), sortOrder: 1 },
    { title: 'Short', coverId: await pm('short-brox-celeste-degrade', 0), sortOrder: 2 },
    { title: 'En la cancha', coverId: await pm('remera-brox-rosa-polvo', 0), sortOrder: 3 },
  ]).returning();
  const items: (typeof schema.storyItems.$inferInsert)[] = [
    { storyId: st[0].id, mediaId: reel.get('torneo-fondo')!, caption: 'II Edición del Torneo BROX en Maxxim Pádel, Villa Gesell', duration: 2, sortOrder: 0 },
    { storyId: st[0].id, mediaId: reel.get('torneo-maniqui')!, caption: 'Del 15 al 17 de agosto · 3 categorías', duration: 2, sortOrder: 1 },
    { storyId: st[0].id, mediaId: reel.get('torneo-premios')!, caption: 'Gracias a todos por participar. ¡Vamos por más!', duration: 2, sortOrder: 2 },
    { storyId: st[1].id, mediaId: (await pm('remera-brox-marron-degrade', 0))!, caption: 'Remera marrón degradé', linkLabel: 'Ver remera', linkHref: '/producto/remera-brox-marron-degrade', duration: 4, sortOrder: 0 },
    { storyId: st[1].id, mediaId: (await pm('remera-brox-blanca', 1))!, caption: 'Blanca con trama', linkLabel: 'Ver remera', linkHref: '/producto/remera-brox-blanca', duration: 4, sortOrder: 1 },
    { storyId: st[1].id, mediaId: (await pm('remera-brox-violeta', 0))!, caption: 'Violeta + trama', linkLabel: 'Ver remera', linkHref: '/producto/remera-brox-violeta', duration: 4, sortOrder: 2 },
    { storyId: st[1].id, mediaId: (await pm('remera-brox-azul-degrade', 1))!, caption: 'Azul degradé', linkLabel: 'Ver remera', linkHref: '/producto/remera-brox-azul-degrade', duration: 4, sortOrder: 3 },
    { storyId: st[2].id, mediaId: (await pm('short-brox-turquesa-degrade', 0))!, caption: 'Gris turquesa degradé', linkLabel: 'Ver short', linkHref: '/producto/short-brox-turquesa-degrade', duration: 4, sortOrder: 0 },
    { storyId: st[2].id, mediaId: (await pm('short-brox-celeste-degrade', 0))!, caption: 'Nuevo ingreso: short azul', linkLabel: 'Ver short', linkHref: '/producto/short-brox-celeste-degrade', duration: 4, sortOrder: 1 },
    { storyId: st[2].id, mediaId: (await pm('short-brox-gris-degrade', 0))!, caption: 'Gris degradé blanco', linkLabel: 'Ver short', linkHref: '/producto/short-brox-gris-degrade', duration: 4, sortOrder: 2 },
    { storyId: st[3].id, mediaId: reel.get('rosa')!, caption: 'Sentí la cancha, no la ropa.', linkLabel: 'Ver rosa polvo', linkHref: '/producto/remera-brox-rosa-polvo', duration: 6, sortOrder: 0 },
    { storyId: st[3].id, mediaId: reel.get('violeta')!, caption: 'Indumentaria BROX disponible', linkLabel: 'Ver violeta', linkHref: '/producto/remera-brox-violeta', duration: 5, sortOrder: 1 },
    { storyId: st[3].id, mediaId: reel.get('celeste')!, caption: 'Diseños de máxima calidad con tecnología Dry-Wick', linkLabel: 'Ver celeste', linkHref: '/producto/remera-brox-celeste', duration: 5, sortOrder: 2 },
  ];
  await db.insert(schema.storyItems).values(items);

  /* banners */
  await db.insert(schema.banners).values([
    { placement: 'strip', title: '5% off pagando con transferencia', subtitle: 'Envíos a todo el país', sortOrder: 0 },
    { placement: 'promo', kicker: 'Nueva temporada', title: 'Se vienen nuevas combinaciones de colores', subtitle: 'Estamos trabajando a full para esta nueva temporada.', ctaLabel: 'Ver lo nuevo', ctaHref: '/catalogo?coleccion=nueva-temporada', videoId: reel.get('noche'), sortOrder: 1 },
    { placement: 'promo', kicker: 'Torneo BROX', title: 'II Edición en Maxxim Pádel', subtitle: 'Caballeros Suma 9 y Suma 13, Damas Suma 13. Gracias por participar: ya estamos pensando en el próximo.', ctaLabel: 'Ver las fotos', ctaHref: '/#historias', videoId: reel.get('torneo-fondo'), sortOrder: 2 },
  ]);

  /* envío: no publican costos → a coordinar (editable por zona en el panel) */
  await db.insert(schema.shippingZones).values({ name: 'Envío a todo el país', type: 'zone', price: 0, toQuote: true, eta: 'Costo y plazo a coordinar por WhatsApp', sortOrder: 0 });

  await db.insert(schema.activity).values({ userName: 'sistema', action: 'seed', entity: 'catalog', summary: `Catálogo inicial: ${man.products.length} productos de Tiendanube + ${man.reels.length} recortes de reels de Instagram` });
  console.log(`✔ Seed listo · admin: ${adminEmail} / ${adminPass}`);
  // si la web ya está corriendo, que muestre el catálogo nuevo sin reiniciar
  await fetch(`${config.webInternalUrl}/api/revalidate`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': config.revalidateSecret }, body: JSON.stringify({ tags: ['catalog', 'products'] }) }).catch(() => null);
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
