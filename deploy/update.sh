#!/usr/bin/env bash
# Actualizar el código en el VPS sin cortar el servicio: bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
API_PORT="${BROX_API_PORT:-4110}"; WEB_PORT="${BROX_WEB_PORT:-3110}"
[ -d .git ] && git pull --ff-only
npm ci --no-audit --no-fund
npm run build -w apps/api
npm run db:migrate -w apps/api
API_INTERNAL_URL="http://127.0.0.1:${API_PORT}" npm run build -w apps/web   # las rewrites de Next se fijan al compilar
BROX_API_PORT=$API_PORT BROX_WEB_PORT=$WEB_PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env
echo "✔ Actualizado"
