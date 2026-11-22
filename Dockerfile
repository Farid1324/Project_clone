FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:8.4-fpm-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor gettext-base ca-certificates curl unzip \
    libpq-dev libonig-dev libicu-dev libzip-dev libxml2-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql mbstring intl zip dom xml xmlwriter xmlreader opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-scripts --no-interaction --no-progress
COPY backend/ ./
COPY --from=frontend /build/frontend/dist/ ./public/
COPY backend/docker/nginx.conf.template /etc/nginx/marketplace.conf.template
COPY backend/docker/supervisord.conf /etc/supervisor/conf.d/marketplace.conf
COPY backend/docker/php-production.ini /usr/local/etc/php/conf.d/zz-marketplace.ini
COPY backend/docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-marketplace.conf
RUN composer dump-autoload --no-dev --no-scripts --classmap-authoritative \
    && php artisan package:discover --no-interaction \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R u=rwX,g=rX,o= storage bootstrap/cache \
    && rm -f /etc/nginx/sites-enabled/default \
    && chmod +x docker/production-entrypoint.sh
ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr PORT=10000
EXPOSE 10000
ENTRYPOINT ["sh", "/app/docker/production-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/marketplace.conf"]
