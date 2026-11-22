#!/bin/sh
set -eu
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-}}"
if [ -z "$APP_URL" ] && [ -n "${VERCEL_PROJECT_PRODUCTION_URL:-${VERCEL_URL:-}}" ]; then
    export APP_URL="https://${VERCEL_PROJECT_PRODUCTION_URL:-${VERCEL_URL:-}}"
fi
export PORT="${PORT:-10000}"
case "$PORT" in ''|*[!0-9]*) echo 'PORT must be numeric.' >&2; exit 1;; esac
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
php artisan marketplace:deploy --no-interaction
php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction
chown -R www-data:www-data storage bootstrap/cache
envsubst '${PORT}' < /etc/nginx/marketplace.conf.template > /etc/nginx/conf.d/marketplace.conf
nginx -t
exec "$@"
