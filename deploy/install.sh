#!/usr/bin/env bash
# Instalación en el VPS (Ubuntu + Nginx + PM2 + Certbot). Uso, desde la carpeta del proyecto:
#   sudo bash deploy/install.sh broxpadel.online
# Hace todo: chequea puertos, crea los .env con secretos nuevos y la base de datos (PostgreSQL del servidor
# o, si no hay, el contenedor de docker-compose), instala, compila, migra, carga el catálogo, arranca con PM2,
# agrega SOLO el sitio de Brox a Nginx (nginx -t antes de recargar) y pide el certificado HTTPS.
# No toca los otros sitios ni sus procesos. Se puede volver a correr sin problema.
set -euo pipefail
DOMAIN="${1:?Pasá el dominio: sudo bash deploy/install.sh broxpadel.online}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${BROX_API_PORT:-4110}"; WEB_PORT="${BROX_WEB_PORT:-3110}"
cd "$DIR"
say() { printf '\n\033[1;31m▸\033[0m %s\n' "$*"; }
rnd() { head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

say "Chequeando lo necesario"
for c in node npm pm2 nginx certbot ss; do command -v $c >/dev/null || { echo "✖ Falta $c en el servidor"; exit 1; }; done
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<20||(a===20&&b<9)){console.error("✖ Hace falta Node 20.9 o más (hay "+process.versions.node+")");process.exit(1)}'
for p in "$API_PORT" "$WEB_PORT"; do
  if ss -ltn "( sport = :$p )" | grep -q LISTEN && ! pm2 jlist 2>/dev/null | grep -q '"name":"brox-'; then
    echo "✖ El puerto $p ya lo usa otro sitio. Elegí otros: BROX_API_PORT=4120 BROX_WEB_PORT=3120 sudo -E bash deploy/install.sh $DOMAIN"; exit 1
  fi
done

if [ ! -f apps/api/.env ]; then
  say "Creando la base de datos y los .env"
  if sudo -u postgres psql -tAc 'select 1' >/dev/null 2>&1; then
    DB_PASS="$(rnd)"
    if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='brox'" | grep -q 1; then
      sudo -u postgres psql -qc "alter role brox with login password '$DB_PASS'"
    else
      sudo -u postgres psql -qc "create role brox with login password '$DB_PASS'"
    fi
    sudo -u postgres psql -tAc "select 1 from pg_database where datname='broxpadel'" | grep -q 1 || sudo -u postgres createdb -O brox broxpadel
    PG_PORT="$(sudo -u postgres psql -tAc 'show port' | tr -d ' ')"
    DB_URL="postgres://brox:$DB_PASS@127.0.0.1:$PG_PORT/broxpadel"
    echo "  PostgreSQL del servidor (puerto $PG_PORT), base broxpadel"
  elif command -v docker >/dev/null; then
    DB_PASS="$(rnd)"
    BROX_DB_PASSWORD="$DB_PASS" docker compose up -d db
    echo "BROX_DB_PASSWORD=$DB_PASS" > .env   # lo lee docker compose en los próximos arranques
    DB_URL="postgres://brox:$DB_PASS@127.0.0.1:5433/broxpadel"
    echo "  PostgreSQL en Docker (127.0.0.1:5433)"
    for i in $(seq 1 40); do docker exec broxpadel-db pg_isready -U brox -d broxpadel >/dev/null 2>&1 && break; sleep 2; done
  else
    echo "✖ No hay PostgreSQL ni Docker en el servidor. Instalá uno de los dos (apt install postgresql) y volvé a correr."; exit 1
  fi
  REV="$(rnd)"
  sed -e "s#^DATABASE_URL=.*#DATABASE_URL=$DB_URL#" \
      -e "s#^API_PORT=.*#API_PORT=$API_PORT#" \
      -e "s#^JWT_SECRET=.*#JWT_SECRET=$(rnd)$(rnd)#" \
      -e "s#^REVALIDATE_SECRET=.*#REVALIDATE_SECRET=$REV#" \
      -e "s#^COOKIE_SECURE=.*#COOKIE_SECURE=true#" \
      -e "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMAIN#" \
      -e "s#^WEB_INTERNAL_URL=.*#WEB_INTERNAL_URL=http://127.0.0.1:$WEB_PORT#" \
      -e "s#^SEED_ADMIN_PASSWORD=.*#SEED_ADMIN_PASSWORD=Brox-$(rnd | head -c 12)#" \
      -e "s#^SEED_EDITOR_PASSWORD=.*#SEED_EDITOR_PASSWORD=Brox-$(rnd | head -c 12)#" \
      apps/api/.env.example > apps/api/.env
  sed -e "s#^API_INTERNAL_URL=.*#API_INTERNAL_URL=http://127.0.0.1:$API_PORT#" \
      -e "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=https://$DOMAIN#" \
      -e "s#^REVALIDATE_SECRET=.*#REVALIDATE_SECRET=$REV#" \
      apps/web/.env.example > apps/web/.env.local
  chmod 600 apps/api/.env apps/web/.env.local
fi

say "Instalando dependencias"
npm ci --no-audit --no-fund
say "Compilando la API, migrando y cargando el catálogo"
npm run build -w apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api          # si ya hay productos no pisa nada
# Nginx (www-data) sirve /media directo del disco: que pueda leerlo
chmod a+x "$DIR" "$DIR/apps" "$DIR/apps/api" "$DIR/apps/api/storage" 2>/dev/null || true
chmod -R a+rX "$DIR/apps/api/storage/media"
say "Compilando la tienda"
API_INTERNAL_URL="http://127.0.0.1:${API_PORT}" npm run build -w apps/web   # las rewrites de Next se fijan al compilar

say "Arrancando con PM2 (brox-api y brox-web)"
BROX_API_PORT=$API_PORT BROX_WEB_PORT=$WEB_PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

say "Nginx: sitio propio de Brox"
CONF=/etc/nginx/sites-available/broxpadel
if [ ! -f "$CONF" ] || ! grep -q "managed by Certbot" "$CONF"; then
  sed -e "s#DOMINIO#$DOMAIN#g" -e "s#RUTA#$DIR#g" -e "s#127.0.0.1:3110#127.0.0.1:$WEB_PORT#" -e "s#127.0.0.1:4110#127.0.0.1:$API_PORT#" deploy/nginx-broxpadel.conf > "$CONF"
  ln -sf "$CONF" /etc/nginx/sites-enabled/broxpadel
fi
nginx -t && systemctl reload nginx

say "Certificado HTTPS"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  EMAIL_ARGS=(--register-unsafely-without-email); [ -n "${CERTBOT_EMAIL:-}" ] && EMAIL_ARGS=(-m "$CERTBOT_EMAIL")
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
    || certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
    || echo "⚠ Certbot no pudo. Revisá que el DNS de $DOMAIN apunte a este servidor y corré: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

sleep 3
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" http://127.0.0.1:$WEB_PORT/ || true)
echo
echo "✔ Brox Padel en https://$DOMAIN  (tienda local: HTTP $code)"
ADMIN_EMAIL=$(grep '^SEED_ADMIN_EMAIL=' apps/api/.env | cut -d= -f2-); ADMIN_PASS=$(grep '^SEED_ADMIN_PASSWORD=' apps/api/.env | cut -d= -f2-)
echo "  Panel: https://$DOMAIN/admin · usuario $ADMIN_EMAIL · contraseña $ADMIN_PASS"
echo "  (la contraseña quedó en apps/api/.env; cambiala desde el panel en Usuarios)"
