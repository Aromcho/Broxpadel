# Plan y decisiones · Brox Padel

## Concepto

BROX vende ropa de pádel para jugar: remeras de secado rápido con UPF 50+, remeras retro y shorts, desde Villa Gesell y con envío a todo el país. La tienda tenía que sentirse como la cancha, no como una plantilla de e-commerce.

**Portada: los videos reales de la cancha.** De fondo pasan los reels de @broxpadel en la cancha, uno detrás de otro, con el logo, la frase *Ropa que rinde como vos.* y el botón a la colección. Debajo, una franja con lo que hace distinta a la ropa: Dry-Wick, UPF 50+, poliéster ultraliviano y envíos. (La primera versión tenía una cancha 3D que se jugaba con el scroll; se reemplazó por los videos reales.)

- Del logo salen el motivo gráfico y el movimiento: las **líneas de velocidad** y la **inclinación de −16°** están en los botones, las etiquetas, los títulos y los títulos.
- Tipografía: una sola familia variable, **Archivo**, en tres anchos: expandida e itálica para títulos (como el logo), condensada para etiquetas y números tabulares para precios.
- Paleta: rojo BROX `#fb2324`, césped `#d9161d`, noche `#0a0f1a`, tiza `#f3f2ee`, vidrio `#9ccfd0` y amarillo pelota `#d9ee3b` (solo para acentos chicos).

## Secciones

1. Portada con los videos de la cancha y franja de características.
2. Historias destacadas como en Instagram + catálogo con filtros y *Vista 3D*.
3. Colecciones (Nueva temporada, Conjuntos, Torneo BROX).
4. *En la cancha*: reels reales con la prenda que se ve en cada uno.
5. Banners con video y franja de información (envíos, pagos, cambios).
6. Ficha de producto con video de la prenda y fotos, pestaña 3D y AR, colores de la familia, talles con stock, guía de talles, *En acción* y *Combinala con*.
7. Carrito, checkout (Mercado Pago, transferencia con descuento, WhatsApp), seguimiento del pedido.
8. Contacto, envíos y pagos, talles, arrepentimiento, 404.

## 3D de las prendas (opcional, convive con los videos)

La ficha arranca con el video de la prenda en la cancha (si tiene) y las fotos; el 3D queda en una pestaña aparte (*Girar en 3D*) con AR. En el catálogo, al pasar el mouse se ve el video, o el 3D si la prenda no tiene video; *Vista 3D* hace girar todas. Cómo se hicieron los modelos:


Se probaron tres caminos sobre las mismas remeras (`media/3d/comparacion-3d.jpg`):

| Opción | Resultado | Costo |
|---|---|---|
| A. Imagen a 3D con IA (Tripo / Meshy / TRELLIS / Hunyuan) | Forma genérica, el estampado BROX sale borroso o inventado | API paga por modelo; no se gastó nada |
| **B. Maniquí invisible desde las fotos reales** (elegida) | Silueta exacta de cada prenda, estampado nítido de frente y espalda, 0,17–0,30 MB por modelo | Gratis, local |
| C. Relieve 2.5D con mapa de profundidad (Depth Anything V2) | Bien de frente, se rompe al girar más de 30° | Gratis, local |

**Cómo se hace la B** (`tools/garment3d.py`): segmentación de la prenda (u2net_cloth_seg), recorte canónico, alineación de la espalda con la de frente, volumen a partir de un torso elíptico más tubos para mangas y piernas, malla Delaunay, atlas de fotos de frente y espalda (2048×1024) más un mapa de normales de tela. Después `gltf-transform` (meshopt + WebP) y el USDZ para iPhone con el exportador de three.js (`tools/build_usdz.py`).

## Rendimiento

- La portada muestra primero el póster del video (WebP) y carga solo el video actual y el siguiente; los demás no se descargan hasta que les toca.
- Videos en MP4 (H.264) y WebM (VP9), 720/1080, recorte vertical para celular y horizontal para escritorio, sin audio.
- El 3D (three.js) se descarga solo si se abre la pestaña *Girar en 3D*, se prende *Vista 3D* o se pasa el mouse por una prenda sin video; el catálogo usa **un solo lienzo WebGL** para todas las prendas. Los videos se descargan solo al verlos.

## Calidad

- `next build` y `nest build` sin errores.
- Capturas de todas las páginas, celular y escritorio (`npm run qa`).
- Compra de punta a punta con Mercado Pago simulado (`npm run test:e2e`): 14/14 pasos.

## Pendiente del lado de la marca

Ver *Datos que faltan* en el README: WhatsApp a confirmar, email, alias/CBU, costos de envío, stock real, talles de shorts, credenciales de Mercado Pago, SMTP y dominio.
