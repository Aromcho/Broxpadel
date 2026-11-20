/**
 * Interruptores de la tienda.
 * Prendas en 3D (pestaña "Girar en 3D", AR, Vista 3D del catálogo): ocultas por ahora.
 * Para volver a mostrarlas: NEXT_PUBLIC_SHOW_3D=1 en apps/web/.env.local y recompilar la web.
 * Los modelos siguen cargados en el panel (Productos → Modelo 3D y AR).
 */
export const SHOW_3D = process.env.NEXT_PUBLIC_SHOW_3D === '1';
