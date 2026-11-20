# Product details and seller-specific cart

Implemented November 20, 2026, against the existing Laravel/PostgreSQL marketplace. This milestone completes the requested product page and a working guest-cart slice. Payment, login and delivery are separate future milestones.

## Delivered behavior

- `/products/:slug` displays API-owned artwork, title, platform, activation region, original description, edition, categories and available-from price.
- Seller rows show seller name, rating/count, independent price, exact available demo-stock count, and a working Add to cart button. Offers sort by price ascending, including visible sold-out offers; the lowest-available badge excludes unavailable stock.
- The page explains region restrictions, platform incompatibility, digital delivery, product-specific activation steps, and Windows minimum/recommended specifications or console/gift-card account/device requirements. Requirements are plain text, with source links for the PC snapshots.
- Choosing a seller POSTs that offer's UUID. More expensive sellers are retained exactly; another seller for the same product becomes a separate cart line. Repeated additions increment the same offer's quantity.
- `/cart` has persistent session-owned lines, current seller prices/totals, per-offer quantity controls, refresh and removal. The header shows the summed quantity. No frontend cart fixtures or local-storage cart are used.
- Sold-out offers are disabled. Published products with no available sellers remain readable; missing/unpublished products show a 404 recovery view. Backend conflicts display an actionable message rather than success. Unavailable cart lines remain visible and removable.
- Product/cart loading, empty, error and retry states are implemented. Desktop offers use aligned rows; mobile offers and the cart summary stack. Shared theme tokens and existing shell/components are retained.

## Run and upgrade

From the repository root on the configured portable Windows environment:

```powershell
.\scripts\local-database.ps1 start
Set-Location backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan db:seed --no-interaction
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

In another terminal, from the repository root:

```powershell
npm.cmd ci --prefix frontend
npm.cmd run dev --prefix frontend
```

Open `http://127.0.0.1:5173/store`, select a listing, choose a seller, then follow View cart. Global PHP users can use `php` instead of the portable executable. For a new installation, run `.\scripts\setup-local.ps1` first; it installs the portable runtimes/dependencies, initializes missing local secrets, migrates and seeds. [Full setup and Docker alternative](backend-setup.md).

The additive migration creates nullable `requirements jsonb`, `delivery_information text` and `compatibility_notice text` on products. Seeding fills all 45 listings from checked-in metadata/seeder rules, without runtime external requests. Existing stock allocations, historical orders, encryption keys and fingerprint secret are retained. Do not reset the development database or regenerate its existing secrets.

## Code and data flow

`ProductResource` includes the three new metadata fields only on product details. Requirements contain labeled minimum/recommended values, notes and optional provenance. Product-specific activation steps take priority over platform fallback instructions. `ProductRequirements` renders these values as semantic description lists; no upstream HTML is injected into React. [Metadata sources and limitations](product-data-provenance.md).

`SellerOfferCard` invokes `useAddToCart(product.slug)` with `offer.id`. The fetch client obtains the Sanctum CSRF cookie as needed and sends X-XSRF-TOKEN on writes. React Query cancels stale cart reads before mutations, installs the authoritative returned cart on success, and refreshes after errors. Writes have no automatic network/server-error retries; a single 419 retry refreshes the token because forgery middleware rejects the request before the mutation. A network failure advises refreshing before trying again.

`CartController` validates through dedicated Form Requests and delegates to `Services/Cart/CartService`. The service resolves ownership from the authenticated request user, or the server-side guest session. It never accepts a client owner/cart ID. Each transaction locks the cart, then the selected offer, validates publication/seller status/current stock and policy limits, changes the line and increments cart version. A guest pointer is stored only after commit; a failed first addition creates no stray cart. GET does not create an empty database cart. `CartResource` hydrates current prices and stock through Eloquent relationships without loading or exposing key plaintext.

Cart routes explicitly attach web/session/forgery middleware, session blocking and a 90/minute/IP throttle. Public catalog/home/search reads are stateless and do not create competing session cookies. Real HTTP tests verify cross-site requests without a token are rejected and independent browser sessions cannot mutate one another's items. Laravel 13 also accepts its same-origin Fetch Metadata validation; see the exact [API write contract](api-design.md#cart-ownership-and-write-contract).

## API additions

| Route | Input / result |
| --- | --- |
| GET `/api/v1/products/{slug}` | Existing endpoint now adds requirements, delivery and compatibility metadata |
| GET `/api/v1/cart` | Current cart or empty envelope; sets up the browser session |
| POST `/api/v1/cart/items` | `offer_id` UUID and optional `quantity` 1–9; same-offer quantity increments |
| PATCH `/api/v1/cart/items/{item}` | Owned cart-item UUID, quantity 1–9 |
| DELETE `/api/v1/cart/items/{item}` | Owned cart-item UUID, returns updated cart |

Cart responses include limits (nine per offer, twenty distinct offers), current price totals, version and unavailable-line flags. Extra fields, invalid IDs/quantities, unavailable offers and foreign lines receive the documented 422/404/409 errors. [Complete resources and error envelope](api-design.md).

## Verification performed

| Check | Actual result |
| --- | --- |
| Full PostgreSQL/PHPUnit suite | 82 passed, 1,069 assertions |
| Full Playwright suite | 63 passed, zero failed/skipped/flaky |
| New product/cart browser subset | Eight passed, including desktop/mobile seller-specific flow and two populated-cart axe scans |
| Accessibility in full browser suite | Ten axe scans, zero detected violations in scanned states |
| TypeScript/Vite production build | Passed |
| Frontend lint | Passed |
| Laravel Pint | Passed |
| Local screenshot capture | Nine route/viewport combinations; no page overflow, missing images or browser exceptions |

`ProductCartTest` adds twelve meaningful tests: product-offer-seller relationships and price sorting, detail-only fields, empty-cart behavior, exact seller/price retention without allocation, two-seller lines and repeated additions, stock rollback, hidden/sold-out rejection, payload tampering, guest isolation, authenticated owner priority, unavailable-line removal/current prices, quantity/line limits, and complete seeded metadata. The final metadata test covers all 45 listings, three activation steps each, and source-backed PC requirements.

The eight new browser tests cover the more-expensive seller flow at 1440px and 390px (POST offer ID, response price, quantity changes, reload persistence, removal), two sellers retained separately, one/all sold-out and no-offer states, a 409 response with no false success/retry, real HTTP CSRF/session isolation, and populated-cart axe/layout checks at both widths. Failure/unavailable simulations are explicitly intercepted; ordinary cart operations use the real seeded Laravel API and database. Public stateless responses are checked for absence of Set-Cookie.

Run backend checks from `backend/`:

```powershell
& ..\.tools\php\php.exe artisan test --compact
& ..\.tools\php\php.exe artisan test --filter=ProductCartTest --compact
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
```

Run frontend checks from `frontend/`, with PostgreSQL and Laravel running:

```powershell
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npx.cmd playwright test tests/product-cart.spec.ts
npm.cmd run capture:local
```

The verified full browser run used the existing portable opcode-cached PHP server described in the [homepage guide](homepage-milestone.md), with `CACHE_STORE=array` only in that QA server process to avoid accumulating rate-limit counters across the sequential suite. Normal runtime uses its configured shared cache; PHPUnit uses test-only in-memory sessions/cache and the isolated `marketplace_testing` database. Thus browser QA does not prove distributed-cache/session-lock contention. No dependency changes were needed. [Structured verification](product-verification.json).

## Visual review

Inspected the refreshed product and populated-cart captures at 1440px and 390px. Product requirements collapse to one column; seller purchase controls stay readable; mobile section anchors scroll within their own row. Header cart controls remain reachable. Existing original symbolic cover artwork remains clearly labeled as demo artwork. The earlier Eneba reference captures and design study are retained in [design documentation](ui-design-system.md); this milestone did not copy official artwork or claim a pixel-identical live product page.

- [Desktop product](ui-screenshots/keymarket-product-desktop-1440-full.png)
- [Mobile product](ui-screenshots/keymarket-product-mobile-390-full.png)
- [Desktop cart](ui-screenshots/keymarket-cart-desktop-1440.png)
- [Mobile cart](ui-screenshots/keymarket-cart-mobile-390-full.png)
- [Capture measurements](ui-screenshots/observations.json)

## Trade-offs and remaining work

The cart stores offer IDs and quantities, so current price/stock can change. It does not reserve or allocate inventory. Checkout must revalidate and atomically lock/allocate keys with price confirmation and idempotency. Existing cart/offer locks and integration tests are not a multi-process checkout contention test. Cart version is exposed but not enforced as an optimistic precondition yet. Login, registration/logout, guest-to-user cart merging, cart expiry/cleanup and cross-tab coordination remain future work.

Product requirements are checked-in snapshots with verification links; there is no automated publisher synchronization. Windows specifications are not a promise about Mac/Linux, every console generation, or country-specific activation eligibility. Demo regions/prices/ratings remain illustrative, and all inventory is nonredeemable. The page explicitly describes these practical limits.

## Changed files

The complete per-file A/M/D manifest for this milestone is [product-changed-files.json](product-changed-files.json), calculated against the file hashes saved before this task because the repository has no initial commit. It excludes ignored dependencies, build outputs, secrets, traces and local import tools. A means added during this milestone; M means changed from the captured baseline.

| Area | Files and purpose |
| --- | --- |
| Laravel detail data | Additive product-details migration; Product model; ProductResource; DemoMarketplaceSeeder and data/product-details.json |
| Cart API | CartController; AddCartItemRequest; UpdateCartItemRequest; CartResource; CartService; API routes; cart throttle/error mapping |
| React | ProductPage; ProductRequirements; SellerOfferCard; CartPage; Header; App routing; useCart; API transport/types; product-cart.css/index import; About copy |
| Tests and captures | ProductCartTest; product-cart.spec.ts; updated marketplace assertions; capture-local.mjs; refreshed home/store/product captures and new cart captures |
| Documentation | This guide, provenance, verification/manifest, API/schema/setup/architecture/plan/readmes and verbatim available chat history |
