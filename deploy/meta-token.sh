#!/usr/bin/env bash
# Carga el token de la API de conversiones de Meta en apps/api/.env y recarga la API.
# Uso (en el servidor):  bash deploy/meta-token.sh   → pegá el token cuando lo pida (no se muestra en pantalla).
# El token sale de: Administrador de eventos → "Brox Padel · broxpadel.com" → Configuración → API de conversiones → Generar token de acceso.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV=apps/api/.env
read -rsp "Pegá el token de Meta y apretá Enter: " TOKEN; echo
TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
if [ ${#TOKEN} -lt 50 ]; then echo "Ese token es muy corto: no se guardó nada."; exit 1; fi
cp "$ENV" "/root/backups/api-env-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
grep -v '^META_CAPI_TOKEN=' "$ENV" > "$ENV.tmp" || true
printf 'META_CAPI_TOKEN=%s\n' "$TOKEN" >> "$ENV.tmp"
mv "$ENV.tmp" "$ENV" && chmod 600 "$ENV"
pm2 reload brox-api --update-env >/dev/null
echo "Listo: token guardado y API recargada."
