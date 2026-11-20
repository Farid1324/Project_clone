# Single-origin deployment: Render + Neon

Status: configuration prepared; **not publicly deployed and no public URL verified**. Source is published to [Farid1324/Project_clone](https://github.com/Farid1324/Project_clone). No authenticated Render/Neon deployment session is available in this workspace. Local HTTPS verification is recorded in [the assignment audit](assignment-audit.md).

## Hosting choice, checked November 20, 2026

Use one Render Free Docker service for Nginx, PHP-FPM, Laravel and compiled React, with Neon Free PostgreSQL 18. Render supplies public HTTPS. Its free web service sleeps after fifteen idle minutes, loses runtime filesystem changes on restart, and shares a 750-hour monthly workspace allowance. Free Render PostgreSQL expires after thirty days, so this solution uses external PostgreSQL. [Render Free documentation](https://render.com/docs/free).

Neon's current Free plan includes 100 CU-hours/project, 1 GB/project storage and 5 GB/project public transfer, with idle compute scale-to-zero. Monitor usage and recheck changing plan limits. [Neon plans](https://neon.com/docs/introduction/plans). Neon supports the required [pg_trgm extension](https://neon.com/docs/extensions/pg_trgm).

The Sites connector cannot run this required PHP/PostgreSQL stack; no frontend-only substitute was published.

## Production files

| File | Purpose |
| --- | --- |
| [Root Dockerfile](../Dockerfile) | Node 24 locked build; PHP 8.4 with Composer --no-dev; compiled frontend copied into Laravel public/ |
| [render.yaml](../render.yaml) | Free Docker service, readiness path, runtime secrets, database sessions/cache and first-boot demo flags |
| [Environment example](../backend/.env.production.example) | Public origin, stable secrets, direct TLS database URL and secure cookies |
| [Nginx template](../backend/docker/nginx.conf.template) | PORT binding, public document root, front controller, immutable hashed assets, missing-asset 404s, CSP/security headers |
| [Entrypoint](../backend/docker/production-entrypoint.sh) | Migrations, optional initial seed, Laravel caches and foreground supervision |
| [Supervisor](../backend/docker/supervisord.conf) | Nginx/FPM lifecycle; two on-demand workers; stderr logging |
| [Deploy command](../backend/app/Console/Commands/DeployMarketplace.php) | Stable-secret/HTTPS checks, migration serialization and empty-catalog demo seeding |

React uses relative /api/v1, /sanctum and /demo URLs. Deep links serve the compiled index; API, Sanctum, health and asset namespaces never fall back to HTML. Secure, HttpOnly, SameSite=Lax cookies stay on one origin. Production runs Nginx/PHP-FPM rather than Vite or artisan serve.

Sessions, locks, carts, orders and encrypted keys live in PostgreSQL. Original artwork/fonts/build files ship in the image. There is no runtime upload directory or background worker requirement. PHP-FPM inherits environment variables with clear_env=no. Docker ignores secrets, dependencies, tests and generated local state.

## Provision and deploy

1. Review the submission, commit it to your own Git provider repository, push it and connect that repository to Render. This workspace currently has no initial commit or remote.
2. Create a Neon Free project using PostgreSQL 18, near Render Frankfurt where possible. Copy the **direct** connection URL, without a -pooler hostname. Deployment uses session-level advisory locks, unsupported by transaction pooling. [Neon pooling limitations](https://neon.com/docs/connect/connection-pooling).
3. Set the URL's sslmode to verify-full. The blueprint supplies DB_SSLROOTCERT=/etc/ssl/certs/ca-certificates.crt from Debian's CA bundle. URL query parameters override base connection settings: do not leave sslmode=require in the URL while expecting DB_SSLMODE to override it. URL-encode credentials. [Neon TLS guidance](https://neon.com/docs/connect/connect-securely).
4. Generate a stable Laravel key using php artisan key:generate --show, retaining its base64: prefix. Put it only in the host secret settings. Never put secrets in Git, chat, screenshots or Vite variables.
5. Create a Render Blueprint using root render.yaml. Supply APP_KEY and DB_URL. Render generates the separate inventory fingerprint secret once. Retain/back up both secrets with the database: existing encrypted keys depend on them.
6. The entrypoint takes APP_URL from RENDER_EXTERNAL_URL unless you set your own canonical HTTPS origin. Keep SESSION_DOMAIN unset/host-only. TRUSTED_PROXIES=* is intended only behind Render's managed ingress; other deployments should list actual proxy IPs/CIDRs.
7. Use a manual deploy after reviewing CI. Wait for service readiness. Startup migrates before the server starts, then seeds only an empty catalog when explicitly enabled. Existing catalog/order/inventory state is preserved on restart. Startup never regenerates secrets or runs migrate:fresh.

Portable key generation, from backend/:

```powershell
& ..\.tools\php\php.exe artisan key:generate --show
```

Render Free lacks shell/one-off jobs and the paid pre-deploy command. Startup migration/seeding avoids depending on those features. [Render limits](https://render.com/docs/free), [Blueprint reference](https://render.com/docs/blueprint-spec).

## Migration and seed operations

The production entrypoint runs:

```sh
php artisan marketplace:deploy --no-interaction
php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction
```

The deploy command validates secrets and production HTTPS APP_URL, takes a PostgreSQL session advisory lock, runs additive migrations with --force, and optionally seeds an empty catalog. Failure prevents startup. A direct database connection is required; disconnect releases the lock.

Normal local maintenance:

```sh
php artisan migrate --no-interaction
php artisan db:seed --no-interaction
```

Explicit production demo initialization, in a trusted release environment with production secrets configured:

```sh
php artisan migrate --force --no-interaction
php artisan db:seed --force --no-interaction
```

Production seeding is refused unless ALLOW_DEMO_SEEDING=true. It is exclusively for this nonredeemable internship demo. SEED_DEMO_ON_FIRST_BOOT=true skips any nonempty catalog. Manual seed reruns update named demo metadata/prices and the demo login fixture; they retain allocations and do not replenish sold slots. Do not use the demo seed as a real inventory importer. All seven existing migrations remain sufficient.

## Verify the public URL

Use the actual canonical HTTPS origin returned by Render:

```sh
node frontend/scripts/verify-public.mjs https://YOUR-ACTUAL-PUBLIC-HOST
```

The read-only verifier rejects loopback/private addresses and checks readiness, compiled assets/cache headers, deep links, same-origin images, six homepage sections, search, secure session cookie flags, guest checkout/history rejection, missing API/asset responses and denied environment paths. It writes status, URL and time to docs/public-verification.json without accounts, purchases or cookie values. Failed runs do not count as deployment success. Public TLS verification stays enabled.

Then complete the [ten audit journeys](assignment-audit.md) in a browser against that public origin, including registration, failed/successful simulation, logout/login and private key retrieval. Check console/network and desktop/mobile layout. Read-only readiness alone does not prove authenticated purchasing on a new host.

On your own disposable public demo, browser regression can use:

```sh
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=https://YOUR-ACTUAL-PUBLIC-HOST npm run test:e2e --prefix frontend
```

This creates demo accounts/orders and consumes demo stock. Public throttles can require pacing; local QA overrides are not a recommendation to disable public limits. Warm a sleeping free service first. Do not enable PLAYWRIGHT_IGNORE_HTTPS_ERRORS for a real public service.

Update README's live URL and verification date only after these checks pass. No public verification occurred here.

## Local build and CI

Without Docker, prepare the compiled single-origin document root on Windows:

```powershell
.\scripts\build-single-origin.ps1
Set-Location backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

Open http://127.0.0.1:8000. This is a development preview. The audit additionally used the Nginx template on local HTTPS with production Laravel settings and PHP-CGI, using a self-signed certificate only for QA.

With Docker available, run `docker build -t keymarket-demo .` to build the production image. Both jobs in [the hosted Actions run](https://github.com/Farid1324/Project_clone/actions/runs/44714423834) passed: backend/frontend checks and 85 browser tests against compiled React, plus the Linux production-image build/startup/deep-link/API checks against disposable PostgreSQL. This does not deploy the application. Docker remains unavailable on this Windows host; actual container execution was verified on GitHub's Linux runner. Nginx/shell syntax, Render's official schema, Laravel operational/cache commands and local HTTPS browser checks were executed separately; see [local verification](audit-verification.json) and [hosted verification notes](publication-ci-fixes.md).
