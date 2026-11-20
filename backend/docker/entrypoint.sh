#!/bin/sh
set -eu
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
if [ ! -f .env ]; then cp .env.example .env; fi
if grep -q '^APP_KEY=$' .env; then php artisan key:generate --no-interaction; fi
if grep -q '^KEY_FINGERPRINT_SECRET=$' .env; then php artisan marketplace:inventory-secret --no-interaction; fi
php artisan package:discover --no-interaction >/dev/null
exec "$@"
