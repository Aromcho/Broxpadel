# Brox Padel · tienda online

Tienda online de **BROX Padel** (Villa Gesell): remeras y shorts de pádel con los videos de la cancha de fondo en la portada, el video de cada prenda en la cancha, carrito, Mercado Pago, transferencia con descuento y pedido por WhatsApp, más un panel para manejar todo desde el celular.

Todo el contenido es real: productos, precios, talles y fotos de la tienda Tiendanube de la marca; videos de los reels de [@broxpadel](https://www.instagram.com/broxpadel/); logo vectorizado de sus publicaciones.

```
apps/
  api/      NestJS 11 + Drizzle + PostgreSQL · Mercado Pago · mails · sharp/ffmpeg/gltf-transform
  web/      Next.js 16 (App Router) + Tailwind 4 + motion · three.js / React Three Fiber · GSAP + Lenis
media/
  curated/  fotos limpias por producto y recortes de reels (de acá sale el catálogo inicial)
  3d/       modelos 3D de las prendas (ya no se usan en la tienda; quedan por si se retoman)
  brand/    logo vectorizado (SVG) · fonts/ Archivo en TTF (para el video)
  raw/      lo descargado del Instagram (no hace falta para correr la tienda)
tools/      scripts para regenerar el 3D, el logo, la imagen OG y los USDZ
qa/         pruebas con Playwright (capturas + compra de punta a punta) y Mercado Pago simulado
deploy/     Nginx, PM2 e instalador para el VPS
reel/       video de lanzamiento para Instagram
```

## Levantarlo en Windows

Necesitás:

- **Node.js 20.9 o más nuevo** (LTS): https://nodejs.org
- **Docker Desktop** (solo para la base de datos): https://www.docker.com/products/docker-desktop. Si ya tenés PostgreSQL instalado, podés usarlo: poné su URL en `DATABASE_URL` de `apps/api/.env` y corré `npm run setup -- --no-docker`.

En PowerShell, dentro de esta carpeta:

```powershell
npm install
npm run setup     # crea los .env, levanta PostgreSQL, crea las tablas y carga el catálogo
npm run dev       # API en :4000 y tienda en :3000
```

- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin

| Usuario | Email | Contraseña | Puede |
|---|---|---|---|
| Administrador | `admin@broxpadel.com` | `BroxPadel2026!` | todo |
| Editor | `editor@broxpadel.com` | `BroxEditor2026!` | productos, medios, historias, banners y pedidos |

Cambiá las contraseñas desde **Panel → Más → Usuarios** apenas entres (o antes del setup, en `SEED_ADMIN_PASSWORD` de `apps/api/.env`).

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run build` | compila la API y la web para producción |
| `npm run start` | corre lo compilado (API :4000 + web :3000) |
| `npm run db:seed -- --force` | borra el catálogo y lo vuelve a cargar desde `media/` |
| `npm run test:e2e` | compra completa de prueba con Mercado Pago simulado (ver *Pruebas*) |
| `npm run qa` | capturas de todas las páginas, celular y escritorio, en `qa/shots/` |

## Qué tiene

**Tienda (pensada primero para el celular)**

- **Portada con los videos reales de la cancha** de @broxpadel de fondo, uno detrás de otro (en vertical en el celular y en horizontal en la computadora), con el logo, la frase y *Ver la colección*. Tiene botón para pausarlos. Debajo, las características de la ropa: Dry-Wick, UPF 50+, poliéster ultraliviano y envíos.
- Las *líneas de velocidad* del logo y su inclinación son el motivo de toda la interfaz: botones, etiquetas y títulos.
- Catálogo con filtros (categoría, talle, color, precio, colección), orden, búsqueda e historias destacadas como en Instagram. En la computadora, al pasar el mouse por una prenda que tiene video, se reproduce.
- Ficha de producto: si la prenda tiene video en la cancha aparece primero y después las fotos; cambio de color sin recargar, stock por talle, guía de talles y *Combinala con*.
- Carrito que se guarda; checkout con **Mercado Pago (Checkout Pro)**, **transferencia con 5% off** y **pedido por WhatsApp** con el mensaje armado. Envío por zona o código postal, retiro, cupones, mails de confirmación y página de seguimiento del pedido.
- Contacto, envíos y pagos, guía de talles, botón de arrepentimiento (Ley 24.240), 404 propia.
- SEO: metadatos, Open Graph con imagen propia, JSON-LD (ClothingStore, Product con ofertas por talle, BreadcrumbList, ItemList), sitemap, robots, manifest e íconos.

**Panel (/admin), cómodo en el celular**

- Inicio con ventas (hoy, 7 y 30 días), gráfico, pedidos para atender, más vendidos, **stock bajo** y actividad.
- Pedidos: pendiente de pago → pagado → preparando → enviado → entregado / cancelado. Mercado Pago los marca como pagados solo (webhook). Notas internas, historial, código y link de seguimiento, botón *Responder por WhatsApp*. Cancelar devuelve el stock; los pedidos de MP sin pagar se cancelan solos a las 48 h.
- Productos con talles, stock, SKU y precio propio por talle; fotos ordenables arrastrando; videos de la prenda; colores agrupados por familia; colecciones; guía de talles; SEO; duplicar.
- Categorías, colecciones, historias destacadas, banners, cupones, zonas de envío, guías de talles, datos del negocio y horarios, usuarios.
- Biblioteca de medios: subir arrastrando fotos, videos, .glb y .usdz; reordenar arrastrando; texto alternativo y etiquetas.
- Todo cambio se ve en la tienda al instante (revalidación por tags).

## Mercado Pago

1. Entrá a https://www.mercadopago.com.ar/developers → *Tus integraciones* → creá una aplicación (Checkout Pro).
2. En **Credenciales de prueba** copiá el *Access Token* y la *Public Key* (empiezan con `TEST-`) en `apps/api/.env`: `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY`.
3. En **Webhooks** configurá la URL `https://TU-DOMINIO/api/payments/mp/webhook` con el evento *Pagos*, y copiá la *clave secreta* en `MP_WEBHOOK_SECRET`.
4. Reiniciá la API. En el checkout aparece *Mercado Pago*.
5. Para probar en local, creá en *Cuentas de prueba* un comprador y pagá con las tarjetas de prueba de la documentación de Checkout Pro (titular `APRO` = pago aprobado). Sin dominio público el webhook no llega, pero el pedido igual se actualiza cuando volvés a la tienda.
6. Para cobrar de verdad, cambiá las credenciales por las de **producción**.

## Videos de cada prenda

**Panel → Productos → (la prenda) → Videos de la prenda → Agregar video**. El primer video aparece antes que las fotos en la ficha y se reproduce al pasar el mouse en el catálogo. Si la prenda no tiene video, se ven solo las fotos.

## Videos

Subilos en **Medios** (o dentro de un producto, historia, colección o banner). Se convierten solos a MP4 (H.264) y WebM a 720p (y 1080p si el original lo permite), con recortes vertical y horizontal, póster WebP y sin audio. Etiquetas que usa la tienda:

- `court` o `bg`: pasa de fondo en la portada. El orden de la biblioteca es el orden en que pasan.

## Pruebas

```powershell
npx playwright install chromium   # una sola vez
npm run build
npm run test:e2e
```

Levanta un Mercado Pago simulado, la API apuntando a él y la tienda compilada, y recorre en un iPhone simulado: compra con cupón pagada por Mercado Pago (con webhook firmado), transferencia con descuento, pedido por WhatsApp, cambio de estados y seguimiento desde el panel, stock en 0 que se refleja al instante y cancelación que devuelve el stock. Deja capturas en `qa/shots/`. Crea pedidos de prueba: para volver al catálogo limpio, `npm run db:seed -- --force`.

## Producción (VPS de Hostinger)

El servidor ya tiene otros sitios: Brox usa **su propio archivo de Nginx, sus propios procesos de PM2 (`brox-api`, `brox-web`) y puertos propios (4110 y 3110)**. No toca nada más.

1. Apuntá el dominio (registro A de `@` y `www`) a la IP del VPS.
2. Cloná el repositorio en el servidor: `git clone https://github.com/Aromcho/broxpadel.git /var/www/broxpadel`.
3. `cd /var/www/broxpadel && sudo bash deploy/install.sh TU-DOMINIO`. Hace todo solo: chequea que los puertos estén libres, crea la base de datos (en el PostgreSQL del servidor o, si no hay, con Docker) y los `.env` de producción con secretos nuevos, instala, compila, migra, carga el catálogo, arranca con PM2, agrega el sitio a Nginx (con `nginx -t` antes de recargar) y pide el certificado con Certbot. Al final muestra el usuario y la contraseña del panel (generada al azar; queda en `apps/api/.env`).
4. Después, cargá en `apps/api/.env` las credenciales de Mercado Pago (`MP_*`) y del correo (`SMTP_*`, `MAIL_NOTIFY`) y reiniciá: `pm2 restart brox-api`.
5. Para actualizar más adelante: `bash deploy/update.sh` (trae los cambios del repositorio, compila y recarga sin cortar).

Backups: la base (`pg_dump broxpadel`) y la carpeta `apps/api/storage/media` (fotos, videos y modelos subidos).

## Datos que faltan

No estaban en el Instagram ni en Tiendanube, así que no se inventaron. Se cargan desde el panel:

- **WhatsApp de la tienda**: quedó cargado provisoriamente el 2255 40-9164; confirmalo o cambialo en *Negocio y horarios*.
- **Email** de contacto, **alias/CBU** para transferencias, **dirección y horarios** si hay local (hoy figura como tienda online en Villa Gesell, sin mapa).
- **Costos de envío** por zona: hoy dice *a coordinar*. Se cargan por código postal o provincia en *Envíos*.
- **Stock real**: Tiendanube no lo publicaba; se cargaron 10 unidades por talle.
- **Talles de los shorts**: Tiendanube los publica como *Único*.
- **Medias**: la categoría existe pero no tenía productos (está oculta).
- **Credenciales de Mercado Pago**, **SMTP** para los mails y **dominio**.
- Muchas fotos de producto de la tienda eran renders con IA (se les sacó la marca de agua). Las fotos con chicos se excluyeron.
