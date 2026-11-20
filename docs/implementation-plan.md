# Incremental implementation and testing

This plan follows the requested order: inspect/propose first, then build working slices. M0 was the initial documentation milestone. The next user request expanded the backend milestone to include catalog/homepage endpoints and the complete relational schema; see [backend-milestone.md](backend-milestone.md) for its delivered scope, setup, changed files, and verified checks. The following UI request delivered the responsive React shell, catalog/search/detail pages, shared components and independent homepage sections described in [ui-milestone.md](ui-milestone.md). It covers the frontend portions of M1, M2 and M5. The next [homepage milestone](homepage-milestone.md) completes six independent homepage services/queries with popular categories, game-only best sellers, deals, gift cards and public discovery recommendations. The [catalog milestone](catalog-milestone.md) completes popularity sorting, three seeded activation regions, shared trigram search, combined-filter and URL-state regression coverage. The [purchasing milestone](purchasing-milestone.md) now completes the requested M3 authentication/cart and M4 simulated checkout/delivery/history journey. Final integrated submission work (M6) remains open. Original M1–M6 below are the historical roadmap, not instructions to re-scaffold the existing application. Use the root README and milestone documents for current executable setup commands. Every future milestone must report actual changed paths, exact setup commands, executed checks with results, and a concise explanation. Do not mark planned checks as passed.

## M0 — inspect and propose

Delivered files: `README.md`, `docs/architecture.md`, `docs/database-schema.md`, `docs/api-design.md`, `docs/implementation-plan.md`, and `docs/ai-chat-history.md`.

Setup: none. Read documents in an editor or run `Get-Content -LiteralPath .\docs\architecture.md` from PowerShell. Validation is document/link/contract consistency inspection, UTF-8/fence checks, and Git whitespace inspection of non-transcript documents. Original whitespace in verbatim transcript messages is preserved. No application tests exist or ran. Repository inspection and tool versions are recorded in the README.

## M1 — runnable foundation

Deliver the React/TypeScript/Vite application with Tailwind, routing and an accessible responsive shell; Laravel with Sanctum installed, PostgreSQL configuration, stateful middleware, readiness/liveness endpoints, and Vite API proxying. Use the shell to show actual API/database connection state. Do not display invented catalog cards. Add repeatable container setup and a native-development path, environment examples, lockfiles, and first CI checks.

Expected changed areas: `frontend/`, `backend/`, `compose.yaml`, root environment example/ignore rules, `.github/workflows/ci.yml`, and setup documentation.

Acceptance: a fresh documented setup serves the SPA and reports a real PostgreSQL-backed readiness result; unavailable database returns `503`; TypeScript production build and backend health checks pass. Verify an actual browser request through the development proxy. Pin working dependency versions after resolving compatibility; do not rely on floating latest versions in reproducible installs.

Initial native bootstrap commands are a proposal, **not runnable M0 application setup**. They require PHP 8.4, Composer, and PostgreSQL 18 with a dedicated development and test database:

```powershell
composer create-project laravel/laravel backend "^13.0" --no-interaction
Set-Location .\backend
php artisan install:api
Set-Location ..
npm.cmd create vite@latest frontend -- --template react-ts --no-interactive
Set-Location .\frontend
npm.cmd install
npm.cmd install tailwindcss @tailwindcss/vite
Set-Location ..
```

These commands only bootstrap frameworks; M1 still must configure PostgreSQL, migrations, UUID session references, Tailwind's Vite plugin/CSS import, routes, proxy, and test scripts. The scaffold generator may resolve current packages once; committed lockfiles govern subsequent installs. On this Windows host use `npm.cmd` if PowerShell script policy blocks `npm.ps1`.

Target repeatable commands after M1 creates the relevant files:

```powershell
docker compose up --build -d
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan test
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
```

M1 must document precisely how container dependencies and the local APP_KEY are initialized, how Compose environment values are supplied, and which URLs/ports to open. No automatic destructive database reset. Existing inventory requires its original encryption/fingerprint secrets. Until Docker is installed, the container commands cannot be verified on this host. The native path likewise needs the absent PHP/Composer/PostgreSQL tooling; do not claim runtime verification before one path is available.

## M2 — catalog, fuzzy search, and seller comparison

Deliver catalog/taxonomy/seller/offer/key-inventory migrations and seeders, encrypted fake inventory, searchable/filterable/sortable product endpoints, shared global suggestion query, and store/detail pages. The root can link or redirect to the working store until homepage sections arrive. Establish minimum-price and eligibility semantics before checkout uses them. Add the allocation FK when order-item tables arrive in M4.

Expected changed areas: catalog models, migrations/factories/seeders, `Queries/Catalog`, catalog controllers/requests/resources, `frontend/src/features/catalog`, global search, and API contract updates.

Setup after implementing the milestone: migrate and run the documented **development-only** demo seeder. Seed deterministically without erasing unrelated data. Example future commands:

```powershell
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=DemoCatalogSeeder
docker compose exec backend php artisan test --filter=Catalog
docker compose exec frontend npm run test -- --run
docker compose exec frontend npm run build
```

Acceptance: partial names and representative typos work against PostgreSQL; facets combine correctly; sorting is deterministic; pagination has no duplicate products; a seller's sold-out cheap offer never produces a misleading available price; multiple seller offers are independently selectable. Browser URL/back/forward behavior preserves search/filter state. Verify suggestion keyboard behavior, cancellation, and narrow-screen layout.

The [product milestone](product-milestone.md) additionally delivers the detailed product experience and the guest-cart portion of M3: selected seller-offer IDs, session ownership, CSRF-protected writes, quantity controls, live prices/stock and removal. That product milestone preceded authentication. The purchasing milestone below now completes M3 and M4; adding a cart item still does not reserve inventory.

## M3 — Sanctum authentication and persistent cart

Delivered by the [purchasing milestone](purchasing-milestone.md): registration/login/logout, hashed passwords, session rotation/revocation, explicit CSRF-protected SPA writes, owner resolution, saved account carts and guest merging. Merge limits are reported to the user; current stock/price/compatibility are reviewed before purchase. The original plan below is retained for historical context.

Deliver register/login/logout/me endpoints and forms, backend guest/account carts, CSRF-protected mutations, version checks, availability warnings, live quote hashes, and transactional cart merging. Use real cookie sessions end to end.

Expected changed areas: auth/cart actions, requests/controllers/policies, cart migrations/models, session configuration, auth/cart React features, and browser tests.

Setup: apply migrations; retain the existing environment and demo catalog. Planned checks are `php artisan test --filter=Auth`, `php artisan test --filter=Cart`, frontend interaction tests, and browser auth/cart tests using the real API. Exact container/native invocations will be supplied with the implementation.

Acceptance: a guest cart survives refresh, merges once on login, remains isolated from other sessions/accounts, handles capped quantities with explicit feedback, and reappears for its owner after logout/login. Stale mutations return conflicts. No password/session data appears in resources. Browser tests demonstrate CSRF enforcement and session lifecycle; Laravel test clients alone may bypass CSRF middleware and are insufficient proof.

## M4 — atomic simulated checkout, delivery, and history

Delivered by the [purchasing milestone](purchasing-milestone.md): authenticated ten-minute quotes, successful/declined simulations, transactional key allocation and snapshots, request-hash idempotency, owner-only order/key history, interrupted-response recovery, and independent-process PostgreSQL contention tests. Real payments, refunds and account recovery remain outside the requested simulation. Original planned acceptance details follow.

Deliver order/payment migrations, immutable snapshots, the digital-key allocation FK/constraints, the checkout action, success/decline UI, owner-scoped history/detail, and explicit key reveal. Add demo historical sales only through consistent order/payment/inventory state.

Expected changed areas: checkout action and simulator, order/payment models, delivery policy/resources, checkout/order React features, PostgreSQL concurrency tests, and purchase browser tests.

Setup: migrate and use clearly fake inventory with stable local encryption/fingerprint secrets. Planned commands include `php artisan test --filter=Checkout`, `php artisan test --filter=Orders`, the documented dedicated concurrency runner, and Playwright purchase tests. The runner must create independent database connections/processes; a test-framework parallel flag alone does not prove contention safety.

Acceptance: approval allocates exactly the requested number of keys and clears the cart; decline retains cart and stock; price/stock changes require reconfirmation; timeout retry returns the original result; two simultaneous buyers cannot receive the same last key; a forced mid-transaction failure leaves no partial order/payment/allocation. Another user cannot view the order or its keys. All persisted terminal states agree across order, payment, amount, and inventory.

## M5 — independent homepage sections and integrated UI

Deliver managed banners, fulfilled-sales-based best sellers, and genuine available deals, each through its own endpoint/query and React request. Finish the common responsive marketplace styling across the existing journey. Add local asset provenance, meaningful empty states, retry behavior, and accessible mobile navigation/filtering.

Expected changed areas: banner migration/seeder, three `Queries/Home` classes, section controllers/resources, `frontend/src/features/home`, design components/styles, and homepage tests.

Setup: migrate and seed documented demo merchandising/sales data. Planned checks include `php artisan test --filter=Home`, frontend homepage tests, and browser purchase/homepage tests plus a production build.

Acceptance: database edits change the appropriate section; expired banners disappear; only fulfilled recent sales count; deals use price/comparison from one stocked offer; no React product content acts as a runtime fallback. Fail each endpoint independently and verify the other sections still render. Check widths around 360, 768, and 1440 pixels, keyboard navigation, focus visibility, and contrast.

## M6 — submission readiness

Complete CI, setup verification from a fresh checkout, contract documentation for implemented endpoints, deployment instructions for a PHP runtime/PostgreSQL, demo walkthrough, ERD, trade-offs, and the AI transcript. Publish only if subsequently included in the requested scope.

Expected changed areas: `.github/workflows`, contract/setup/deployment documentation, meaningful regression tests, and fixes found during acceptance.

Acceptance: clean dependency installs, database migrations/seeding, backend tests on PostgreSQL, frontend typecheck/tests/build, and real-stack Playwright tests pass. Confirm a reviewer can follow the README without undocumented local state. Report checks that could not run and their precise environmental requirements.

## Testing strategy

| Layer | Tool and database | Meaningful behaviors |
| --- | --- | --- |
| Narrow unit tests | PHPUnit; Vitest | Money formatting, quote canonicalization, search ranking decisions, deterministic simulator outcomes |
| API integration | Laravel HTTP tests with PostgreSQL 18 | Facet/search correctness, offer eligibility, resource secrecy, validation, ownership, cart conflicts, checkout transitions, homepage query independence |
| Race/transaction tests | Independent PostgreSQL connections/processes | Last-key contention, concurrent identical checkout, lock ordering, rollback on failure |
| UI behavior | React Testing Library + Vitest | Search debounce/stale results, retry/empty states, cart conflicts, auth redirects, decline recovery, explicit key reveal |
| End to end | Playwright against Vite/Laravel/PostgreSQL | Guest search/cart, register/login merge, approve/decline/replay, reveal, history, logout, CSRF and ownership |

Use PostgreSQL for backend integration tests. SQLite would conceal trigram, locking, partial-index, and PostgreSQL-constraint behavior. Use an isolated database protected by a test-only configuration guard. Rebuild/reset only that explicitly identified test database. Freeze time for banner/sales-window tests and separate deterministic factories from demo seeds.

For contention tests, use committed fixtures and barrier synchronization, not tests wrapped in an outer transaction invisible to other connections. Assert final row counts, exact key identities, totals, and response outcomes. Run them against the same PostgreSQL major as development/CI.

Mock HTTP only for isolated component tests; main browser acceptance calls the real Laravel API. Avoid asserting Tailwind class strings, duplicating framework behavior, or inflating snapshot counts. Add performance measurements with a larger generated dataset: inspect search/offer queries for N+1 behavior and query plans. Set latency budgets only after collecting a reproducible baseline.

## Transcript maintenance

Append each available user-authored prompt and assistant prose response verbatim to `docs/ai-chat-history.md`, including progress updates and the final reply. Preserve Markdown, backslashes, code fences, links, and typos. Log the exact final text before sending it. Never summarize or reconstruct missing messages as though they were original history. Keep administrative scope notes separate from transcript entries.

This environment provides no verified full-chat export facility. Tool transport, private system/developer instructions, and internal reasoning are not part of the user/assistant prose log. If messages fall outside available context, stop claiming completeness, mark the exact gap, and import the original export when supplied. If the client offers a full-chat export, export the entire chat, retain its original file unchanged, and reconcile every user/assistant entry in chronological order. Otherwise copy each original message individually in full; avoid UI-generated summaries or screenshots as a substitute for text. Do not invent an export menu path or a CLI command that has not been verified.
