/**
 * IDs públicos de medición (van en el HTML de cualquier tienda; no son secretos).
 * Se pueden cambiar por variable de entorno y recompilar. NEXT_PUBLIC_TRACKING=off los apaga.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '1855460625691111';
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? 'G-KV2EMNNHG2'; // propiedad broxpadel.com (cuenta broxpadel@gmail.com)
/** Verificación de broxpadel.com en el portfolio BROX de Meta (Configuración → Dominios). */
export const META_DOMAIN_VERIFICATION = process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION ?? 'byum5e3t17279pgviq9xxvjpq1k6rs';
/** Search Console (cuando se cree la propiedad). */
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';
/** En `next dev` (la tienda en la PC) no se mide nada. */
export const TRACKING_ON = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TRACKING !== 'off';
