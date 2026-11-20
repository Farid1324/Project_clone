#!/bin/sh
set -eu
: "${GITHUB_ENV:?This helper is for disposable GitHub Actions runners}"
: "${DB_DATABASE:?Select the disposable database}"
DB_PASSWORD="$(openssl rand -hex 32)"
export DB_PASSWORD
printf '::add-mask::%s\n' "$DB_PASSWORD"
printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD" >> "$GITHUB_ENV"
docker run --detach --name marketplace-postgres \
    -e POSTGRES_DB="$DB_DATABASE" -e POSTGRES_USER=marketplace -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -p 127.0.0.1:5432:5432 postgres:18-bookworm
for attempt in $(seq 1 30); do
    if docker exec marketplace-postgres pg_isready -U marketplace -d "$DB_DATABASE"; then
        exit 0
    fi
    sleep 2
done
echo 'PostgreSQL did not become ready.' >&2
exit 1
