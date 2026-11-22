# Persistent product wishlist

The wishlist saves products to the authenticated account in PostgreSQL. Hearts on home/store cards and product detail share the same state; the responsive /wishlist page reuses the catalog cards and current seller availability/prices. User-specific data is removed from the client cache on logout or account changes. No dependencies, secrets, seed changes or public wishlist sharing were added.

## Schema and API

The additive migration `2026_11_22_194138_create_wishlist_items_table.php` adds UUID wishlist_items with user_id/product_id foreign keys, a unique user/product pair, timestamps and indexes for owner/order/product access. WishlistItem belongs to User and Product; both expose wishlistItems. Hard deletion of either parent cascades the association; unpublishing or losing inventory preserves it. New accounts have empty wishlists. Factories support isolated tests; no seeder invents private saves for shoppers.

| Authenticated endpoint under /api/v1 | Result |
| --- | --- |
| GET /wishlist?page=1&per_page=24 | Standard paginated ProductResource list, newest save first |
| GET /wishlist/summary | Account-wide count and product_ids, including unavailable saves |
| POST /wishlist | Body product_id UUID; idempotent save; 200 summary |
| DELETE /wishlist/{product UUID} | Idempotent owner-only removal; 200 summary even if absent |

Existing web/session/CSRF middleware, auth:sanctum, private/no-store responses, request/error conventions and rate limiting apply. The owner always comes from authentication; extra POST owner/offer fields are rejected. WishlistService serializes mutations with a user-row lock in a transaction; the unique database constraint independently prevents duplicate rows. No keys are reserved or cart/order data changed.

ProductQuery and ProductResource supply current information without copying prices into the wishlist. Public catalog queries remain published-only. Only the owner-filtered wishlist read opts into unpublished products. Sold-out entries have null price, zero eligible offers and an honest unavailable label. Unpublished entries remain removable with their title/artwork, without a link that would return a missing product page. Published sold-out entries can still open product detail for seller comparison.

## UI and state

WishlistButton is a separate sibling of a card's product link, rather than a button nested inside it. It uses aria-pressed, descriptive save/remove labels, a 44px target and pending/error feedback. The same component appears in product detail. Header shows the full count, independent of the list page. WishlistPage uses RequireAuth, ProductGrid, LoadingSkeleton and AsyncState for loading, retry, empty and pagination recovery states. At narrow phone widths, nonessential header utilities are moved out of the main row and the smallest width keeps the labeled brand symbol.

Guests retain the selected product UUID through the existing allowlisted login/register returnTo flow. After authentication, /wishlist?save=UUID performs the idempotent save and replaces the URL with /wishlist. Reloading before acknowledgment is safe. The intent is removed only after success; an error has an explicit retry.

TanStack Query uses `['wishlist', userId, 'summary']` and `['wishlist', userId, 'products', page]`. A successful write updates the shared summary and invalidates product pages. Controls wait for server acknowledgment; no optimistic rollback is necessary. Failed writes refetch the authoritative state. Counts and hearts therefore represent backend membership, while pagination/stock data come from separate current reads.

Authentication mutations cancel private reads and in-flight wishlist writes before changing sessions, then clear wishlist query and mutation caches on success. This prevents a delayed old wishlist response from overwriting the new session cookie. Aborting a request does not undo a committed save; it remains in the original account and is retrieved on login. If an auth operation fails, current-account wishlist queries are refreshed to reconcile any committed-but-cancelled write. Late mutation callbacks and wishlist 401 handling additionally check the originating account identity.

## Reproduce

From an existing checkout using the portable Windows runtime:

```powershell
.\scripts\local-database.ps1 start
Set-Location backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan route:list --path=wishlist --except-vendor
Set-Location ..
.\scripts\build-single-origin.ps1
Set-Location backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

Open http://127.0.0.1:8000 and register/sign in. A fresh installation follows README setup first. Global PHP installations use php in place of the portable executable. No db:seed, migrate:fresh or secret regeneration is needed for this feature. Production's existing marketplace:deploy applies additive migrations during startup; deploy the latest compiled frontend and backend together.

From backend/:

```powershell
& ..\.tools\php\php.exe artisan test --compact --filter=WishlistTest
& ..\.tools\php\php.exe artisan test --compact
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
```

From the repository root:

```powershell
npm.cmd run typecheck --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8000'
# Keep Laravel serving compiled React; PostgreSQL must be running.
Set-Location frontend
npx.cmd playwright test tests/wishlist.spec.ts
npm.cmd run test:e2e
```

Browser tests create disposable demo accounts; existing purchase regressions also consume demo stock. Use development fixtures. Backend tests are guarded to use marketplace_testing. The executed browser environment uses compiled React/Laravel on one local HTTP origin with QA-only array cache and reduced password hashing cost. It is not a public or production HTTPS deployment.

## Verification and limits

The focused PHP suite covers guest rejection, current-user ownership, duplicate saves, repeated/absent removals, exact product relationships, live price changes, sold-out/unpublished entries, no inventory allocation, validation, pagination, database uniqueness and FK cleanup. The complete PHP suite also exercises the existing checkout/concurrency flow.

Fourteen new browser tests cover real persistence across page/reload/logout/login, independent keyboard heart actions, home/detail/card consistency, guest intent through registration, account isolation, list/summary loading and retry, failed add/remove, 25-item pagination/counts, out-of-range recovery, revoked sessions, cancelled delayed responses and failed-logout reconciliation. Unpublished UI behavior uses an isolated serialized-response simulation; PHP tests change actual database publication/stock state. Four wishlist axe scans and overflow checks cover 1440, 768, 390 and 320px. Existing browser regressions exercise the remaining marketplace.

**Final executed results:** 122 PHP tests / 1,442 assertions; 11 focused wishlist tests / 122 assertions; 99 browser tests including 14 wishlist cases; eighteen total axe scans; eight secret-check/exporter tests. TypeScript, lint, build, Pint and the additive migration passed.

Detailed results and limits are in [wishlist-verification.json](wishlist-verification.json); changed files are in [wishlist-changed-files.json](wishlist-changed-files.json). Desktop/mobile captures were visually inspected: [1440px](ui-screenshots/keymarket-wishlist-1440.png), [390px](ui-screenshots/keymarket-wishlist-390.png). No cloud deployment, Docker run or hosted CI run is implied. The full available conversation prose is exported from the original local session with the existing exporter and per-message integrity manifest; an after-final refresh captures the final response once persisted.
