# Backend setup and operation

## Requirements and scope

For the compiled single-origin preview and production Nginx/PHP-FPM setup, see [deployment.md](deployment.md). The root Dockerfile is the production image; the older backend Dockerfile and compose.yaml below remain development tools. Production demo seeding is now explicitly opt-in, with guarded empty-catalog initialization through marketplace:deploy.

Verified with PHP 8.4.28, Laravel 13.43.0, Sanctum 4.5.0, and PostgreSQL 18. Composer dependencies are locked. Use PHP 8.4 with PDO PostgreSQL, OpenSSL, mbstring, fileinfo, DOM/XML/XMLWriter, and other extensions checked by Composer. The optional portable installer also enables intl/zip/pgsql. No frontend or Node build is required for this backend.

The API exposes catalog/homepage content, session-owned carts, Sanctum cookie registration/login/logout, authenticated quote/checkout, and owner-scoped order history/key retrieval. Payment is strictly simulated and every key is nonredeemable. See the [purchasing milestone](purchasing-milestone.md) for the transaction, retry and concurrency design.

## Windows portable path â€” verified

Run from the repository root in **PowerShell 7**:

```powershell
.\scripts\setup-local.ps1
Set-Location .\backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

First setup needs network access and the Microsoft Visual C++ runtime. `bootstrap-windows.ps1` downloads a pinned PHP zip, verifies its published SHA-256, verifies the official Composer installer signature, and verifies the pinned embedded PostgreSQL package's npm integrity. Tools, downloads, credentials for this local cluster, and PostgreSQL data stay under ignored `.tools/`. Sources: [PHP Windows builds](https://windows.php.net/download/), [Composer installation](https://getcomposer.org/download/), [embedded-postgres project](https://github.com/leinelissen/embedded-postgres).

The helper initializes a PostgreSQL cluster restricted to `127.0.0.1:55432`, creates `marketplace` and `marketplace_testing`, and generates a random database password under ignored `.tools/pg-init-password`. Setup copies it into an empty `DB_PASSWORD` in ignored `backend/.env` without printing it. Existing local credentials are retained. This is a private local development cluster, not a production deployment.

Run every migration and the complete DatabaseSeeder explicitly, from `backend/`:

```powershell
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan db:seed --no-interaction
# Equivalent named seeder, when you want only the marketplace demo:
& ..\.tools\php\php.exe artisan db:seed --class=DemoMarketplaceSeeder --no-interaction
# Integration suite against marketplace_testing:
& ..\.tools\php\php.exe artisan test --compact
```

To control PostgreSQL from the repository root:

```powershell
.\scripts\local-database.ps1 status
.\scripts\local-database.ps1 stop
.\scripts\local-database.ps1 start
```

The cluster is persistent. Setup and seed reruns do not erase databases or regenerate existing secrets. A local tool version is pinned for reproducibility; if its publisher archives a download in the future, update the URL and checksum together using the publisher's metadata.

## Existing PHP/Composer/PostgreSQL

As a PostgreSQL administrator, provision development-only roles/databases once:

```sql
CREATE USER marketplace;
-- In psql, set a locally chosen password interactively (never commit it):
\password marketplace
CREATE DATABASE marketplace OWNER marketplace;
CREATE DATABASE marketplace_testing OWNER marketplace;
```

From `backend/`, install dependencies and copy the example environment **only if an environment file does not already exist**:

```sh
composer install
# POSIX shell; on PowerShell use Copy-Item .env.example .env instead:
cp .env.example .env
```

Set DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD to your server; the example port is **55432**, while a standard PostgreSQL install often uses **5432**. The application role must own the databases and be allowed to install the trusted `pg_trgm` extension, or an administrator must preinstall it. [PostgreSQL extension documentation](https://www.postgresql.org/docs/18/pgtrgm.html).

Generate the two secrets **once**, then migrate and seed:

```sh
php artisan key:generate
php artisan marketplace:inventory-secret
php artisan migrate
php artisan db:seed
php artisan test --compact
php artisan serve --host=127.0.0.1 --port=8000
```

`APP_KEY` encrypts inventory/session data. `KEY_FINGERPRINT_SECRET` computes inventory HMAC fingerprints. Preserve both when reusing a database. The inventory-secret command refuses to overwrite a nonempty secret and refuses production use. Do not run key generation as a routine restart step.

## Docker Compose â€” provided, not executed here

From the repository root, with Docker Desktop/Compose available:

Copy the root .env.example to ignored .env and set DB_PASSWORD to a newly generated local random value before starting Compose. There is no default shared database password. Existing database volumes retain their original credential.

```sh
docker compose up --build -d
docker compose exec backend php artisan migrate --no-interaction
docker compose exec backend php artisan db:seed --no-interaction
docker compose exec backend php artisan test --compact
```

The API listens at [localhost:8000](http://localhost:8000/api/v1/products). The database is reachable from containers at `db:5432` and from the host at `127.0.0.1:55433` to coexist with the portable cluster. Compose environment values override native DB settings in the shared backend environment file. The PostgreSQL 18 data volume uses the image's versioned-directory layout. [Official PostgreSQL image tags](https://github.com/docker-library/official-images/blob/master/library/postgres).

The initialization SQL creates the isolated test database on the first start of an empty PostgreSQL volume. For a preexisting volume without it:

```sh
docker compose exec db createdb -U marketplace marketplace_testing
```

Source is bind-mounted. Dependencies use a named volume initialized from the image; after dependency changes run:

```sh
docker compose exec backend composer install --no-interaction
```

The entrypoint creates missing local secrets once and does not apply migrations or seed automatically. This configuration runs Laravel's development server with your local database credential. Production requires a PHP-capable server, HTTPS/reverse proxy, managed secrets, database permissions/backups, and a deployment process. No hosting was provisioned.

## What seeding does

For an existing installation, start the database, then from `backend/` run `php artisan migrate --no-interaction` and `php artisan db:seed --no-interaction`. Portable equivalents are `& ..\.tools\php\php.exe artisan migrate --no-interaction` and `& ..\.tools\php\php.exe artisan db:seed --no-interaction`. The product-details migration is additive; do not use migrate:fresh on existing development data. Keep existing encryption/fingerprint secrets.

`DatabaseSeeder` invokes `DemoMarketplaceSeeder` inside a transaction, serialized by a PostgreSQL advisory lock. It upserts named demo taxonomy/sellers/products/offers/promotions/banners, creates only missing deterministic fake key slots, and creates historical orders once using stable idempotency UUIDs. Reruns update demo catalog metadata but do not replace allocated keys or recreate sales. Do not use it to import production stock.

The portable database helper uses 32MB shared buffers and 20 connections for the small local workload; restart through the helper to apply changed startup flags.

All 45 product listings have three seller offers with independent prices, stock, and seller-level ratings. Seeded ratings/counts are fictional fixtures. Sixteen fulfilled historical demo orders (twelve game orders and four gift-card orders) have matching order totals, generated line totals, approved simulated payments, and assigned keys. Homepage best sellers aggregate those orders and subsequent fulfilled demo purchases. A historical-sales fixture user/cart is included with an undisclosed random password, rotated by seeding. Register your own account; there is no shared login. Browser purchasing tests create demo accounts/orders and consume demo stock; run them only against development fixtures, never production.

Product descriptions, requirements, compatibility notices, delivery information and activation steps are now seeded too. The checked-in `database/seeders/data/product-details.json` contains original summaries and Windows requirement snapshots with source links; console/gift-card account/device requirements are authored in the seeder. Seeding is offline and the application never fetches external requirements at runtime. See [product provenance](product-data-provenance.md) and [product milestone commands/tests](product-milestone.md).

All 48 images are original SVG demo artwork under `backend/public/demo/`; titles identify the illustrated catalog item. They are not official game covers. Prices are illustrative EUR values rather than live market quotes.

## Tests and troubleshooting

The suite uses PostgreSQL, not SQLite. `phpunit.xml` forces `DB_CONNECTION=pgsql`, the dedicated `marketplace_testing` database, random per-run encryption/fingerprint secrets from tests/bootstrap.php, and in-memory session/cache stores. Host/port/username/password come from the environment or backend environment file. TestCase refuses cached configuration or a different database before RefreshDatabase can migrate it.

If configuration was cached, run `php artisan config:clear` before testing. Runtime and tests need the database running. Use `php artisan migrate:status` to inspect migrations and `php artisan route:list --path=api` to inspect routes. `GET /up` reports process liveness; `GET /api/v1/health` checks PostgreSQL readiness. The public API returns generic error messages rather than SQL or stack traces.

The verified environment required elevated execution outside the agent sandbox for PHP cache-writability checks and PostgreSQL process/network access. No Windows service or global runtime installation was performed. Docker and hosted CI were not available for execution in this session.
