# Homepage milestone — six independent data providers

Delivered November 19, 2026. React TypeScript and Laravel now render the six requested homepage sections from actual PostgreSQL content. No application dependency or database migration was added.

## Independent data flow

Every row below is a separate Laravel controller action, method-injected service, REST request and TanStack Query cache entry. No section calls another section's endpoint or substitutes another section's products.

| Homepage section | GET /api/v1/home/... | Backend provider and database selection | React query key |
| --- | --- | --- | --- |
| Promotional carousel | banners | BannerService: active homepage_banners in their UTC schedule; published product destinations only; priority/ID order, up to 8 | home-banners |
| Popular categories | categories | PopularCategoryService: categories containing published products with available offers; recent fulfilled quantities on those eligible products, then available product count/name/ID; up to 9 | home-categories |
| Best-selling games | best-sellers | BestSellerService: game products only, ranked by fulfilled order-item quantity over 30 days, with currently available offers; stable product-ID ties; up to 12 | home-best-sellers |
| Special deals | deals | DealService: stocked offers from active sellers in current campaigns, with a genuine comparison-price reduction; select one winning offer per product by discount ratio/price/ID; up to 12 | home-deals |
| Popular gift cards | gift-cards | GiftCardService: available gift_card products ranked by recent fulfilled quantity across all seller offers; unsold/tied products use current minimum price and product ID; up to 12 | home-gift-cards |
| Recommended products | recommendations | RecommendationService: available seller rating, available seller count, release date (nulls last), creation date and product ID; up to 12 | home-recommendations |

All endpoints return `{ "data": [...] }`, including successful empty arrays. They are fixed-size merchandising lists rather than pageable catalog search. The existing catalog and promotion-list endpoints remain compatible; `/home/promotions` is retained for collection consumers but is no longer a separate homepage section.

The controller resolves only the requested section service. Services read Eloquent models and serialize through the existing BannerResource, CategoryResource and ProductResource. RecentSalesQuery shares one definition of recent fulfilled quantities across best sellers, gift cards and categories, excluding failed, older and future-dated orders. ProductQuery shares published-product scopes, current eligible offers, minimum price and eager-loaded platform/region/category/seller resources. No duplicate product per seller is emitted.

A category's `products_count` on this homepage endpoint means currently available published products. Catalog category endpoints retain their documented published-product count. A product can belong to several categories; its sales legitimately contribute to each of those categories.

## React composition and states

HomePage calls five independent hooks for banners and the four product groups. CategoryNavigation owns the sixth hook for popular categories. Header/footer taxonomy remains on the independent catalog-filters endpoint; it does not determine homepage merchandising.

Each hook supplies its own queryKey, query function and AbortSignal to the typed fetch client. TanStack Query retains the existing 60-second client freshness, one retry for network/server errors, and no focus refetch. The shared query cache does not merge section payloads: a rejected gift-card query cannot replace recommendations or hide the carousel. Cancellation follows the [TanStack Query signal pattern](https://tanstack.com/query/v5/docs/framework/react/guides/query-cancellation).

ProductSection shares the heading, loading skeleton, error/retry state, empty state and ProductGrid composition across all four product groups. It displays the first five server-ranked products; that is a presentation limit, not a frontend product selection list. The existing ProductCard links to the API product slug; there are no hardcoded product names, prices, offers, promotion titles or image paths in React.

The carousel's title/subtitle/image/alt/destination come from the banner response; its manual controls change the active API record. Generic UI labels, section headings, icon mappings, loading placeholders and empty-state recovery links are presentational copy. Empty banners show an explicit no-active-promotions state.

Every section has accessible busy/loading state, a genuine empty state and an error with its own working retry button. Categories have their own loading status and empty-state catalog link. Best-seller skeletons adapt to compact mobile rows, matching loaded cards. Existing responsive grids provide five desktop columns, three tablet columns, two mobile cover columns, and compact one-column best-seller rows. Categories scroll horizontally on narrow screens.

## Ranking trade-offs and seeded data

Recommendations are public discovery picks, the same for everyone, based on current seller quality/availability and product dates. They are not personalized, product review scores or a learned model. This provides a deterministic cold-start result without collecting browsing history or inventing a recommendation model. A highly rated unavailable/suspended/inactive offer cannot influence the ranking or displayed price.

Best sellers require real qualifying demo sales and return an empty array when none exist. Categories fall back to available assortment size; gift cards fall back to price; recommendations work without sales. Overlap between independent sections is allowed. This keeps each result explainable and avoids cross-section fetch dependencies.

The existing seeder still provides 44 products, 132 independent seller offers, nine categories, three banners and stock-backed demo prices. Four repeatable historical gift-card orders were added using the existing consistent order/payment/key-allocation routine, alongside the previous 12 game orders. These drive genuine popularity aggregates. Deterministic order UUIDs preserve counts on a second seed, and allocated inventory slots are not replaced. Historical dates are retained on reseeding; after 30 days those orders naturally stop counting as recent.

No schema change was necessary: categories, product type, seller ratings, offers, inventory and order snapshots already exist. Availability is derived from unallocated/nonretired keys and active seller/product/offer scopes. Service classes replace the three old BannersQuery/BestSellersQuery/DealsQuery wrappers; the shared sales and catalog query helpers avoid repeating eligibility/aggregation SQL. Laravel supports the subquery joins used for these bounded rankings. [Laravel 13 query builder](https://laravel.com/docs/13.x/queries#subquery-joins).

There is no server response cache to invalidate. Eager loading prevents per-card relationship reads. The existing indexes support joins and stock checks; no speculative index or materialized counter was added for the small catalog. Checkout will still need fresh transactional stock/price checks in its own milestone.

## Setup

From the repository root in PowerShell 7, use the existing portable toolchain and Node.js 24:

```powershell
.\scripts\setup-local.ps1
npm.cmd ci --prefix frontend
```

The helper already migrates and seeds. On an existing checkout, refresh just the data with:

```powershell
.\scripts\local-database.ps1 start
Set-Location backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan db:seed --no-interaction
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

In another root terminal:

```powershell
npm.cmd run dev --prefix frontend
```

Open [Keymarket](http://127.0.0.1:5173/). Vite proxies API and image requests to Laravel; no frontend data import or generated fixture file is required. Preserve existing .env secrets. For a global toolchain or Docker backend, use [backend setup](backend-setup.md).

## Verification

- **53 backend tests passed / 585 assertions** against PostgreSQL, including the new ten-test HomepageSectionsTest suite and all existing catalog/schema/homepage/seed tests.
- **39 Chromium browser tests passed**, no skipped, flaky or unexpected results.
- Eight axe scans across home/store/about/product at desktop/mobile widths reported zero WCAG 2/2.1/2.2 A/AA violations.
- Clean frontend lint, TypeScript/Vite production build, Laravel route inspection and Pint formatting.
- [Verification snapshot](homepage-verification.json) preserves actual browser test titles, statuses and timings with the backend result.

The dedicated homepage/seed subset separately passed 17 tests / 398 assertions before the full suite. Screenshot geometry and image readiness are checked after the final capture. No Safari/Firefox or real-device result is claimed.

Relevant commands:

```powershell
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
Set-Location backend
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
& ..\.tools\php\php.exe artisan test --compact
```

The first browser run exposed a search timeout under repeated unoptimized Windows PHP development requests. The completed browser run uses the bundled opcode cache to avoid reparsing the framework for every request. No application timeout assertion was weakened. To reproduce that local QA server, stop the ordinary Artisan server, then run from the root:

```powershell
$env:CACHE_STORE = 'array'
Set-Location backend/public
& ..\..\.tools\php\php.exe -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8000 ..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php
```

This process-only array cache avoids shared local rate counters during browser automation; it does not change application defaults. The opcode-cache flags use PHP's bundled extension. [PHP OPcache configuration](https://www.php.net/manual/en/opcache.configuration.php).

In a separate root terminal, with PostgreSQL and the QA server running:

```powershell
Set-Location frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run capture:local
```

Playwright starts or reuses Vite. Successful flows use the real seeded API. Only deliberate loading, empty and failure cases intercept HTTP. All six sections are tested independently for delayed/loading state, empty response and isolated failure/retry. Additional tests compare every product group's IDs/title/image/price, category labels and the hero against each corresponding endpoint, then exercise product/category navigation. Existing search, filters, pagination, dialogs, recovery and accessibility coverage remains.

[Updated screenshots](ui-screenshots/observations.json) record actual desktop/tablet/mobile geometry, images and errors. [Desktop full homepage](ui-screenshots/keymarket-home-desktop-1440-full.png) and [mobile full homepage](ui-screenshots/keymarket-home-mobile-390-full.png) show all six sections. The [design guide](ui-design-system.md) retains the original official-reference study and token rationale.

The owned preview servers are stopped after verification. PostgreSQL remains under the existing local-database helper. No production deployment, Docker execution or non-Chromium browser verification is claimed.

## Changed files

Relative to the preceding UI milestone; the repository still has no initial Git commit. A = added, M = modified, D = retired. Dependencies, build output, test traces, secrets and local tools are excluded.

A: 10, D: 3, M: 27.

```text
A backend/app/Queries/Home/RecentSalesQuery.php
A backend/app/Services/Home/BannerService.php
A backend/app/Services/Home/BestSellerService.php
A backend/app/Services/Home/DealService.php
A backend/app/Services/Home/GiftCardService.php
A backend/app/Services/Home/PopularCategoryService.php
A backend/app/Services/Home/RecommendationService.php
A backend/tests/Feature/HomepageSectionsTest.php
A docs/homepage-milestone.md
A docs/homepage-verification.json
D backend/app/Queries/Home/BannersQuery.php
D backend/app/Queries/Home/BestSellersQuery.php
D backend/app/Queries/Home/DealsQuery.php
M README.md
M backend/app/Http/Controllers/Api/V1/HomepageController.php
M backend/database/seeders/DemoMarketplaceSeeder.php
M backend/routes/api.php
M backend/tests/Feature/DemoSeederTest.php
M docs/ai-chat-history.md
M docs/api-design.md
M docs/architecture.md
M docs/database-schema.md
M docs/implementation-plan.md
M docs/ui-design-system.md
M docs/ui-screenshots/keymarket-home-desktop-1440-full.png
M docs/ui-screenshots/keymarket-home-desktop-1440.png
M docs/ui-screenshots/keymarket-home-mobile-390-full.png
M docs/ui-screenshots/keymarket-home-mobile-390.png
M docs/ui-screenshots/keymarket-home-tablet-768-full.png
M docs/ui-screenshots/keymarket-home-tablet-768.png
M frontend/README.md
M frontend/scripts/capture-local.mjs
M frontend/src/components/CategoryNavigation.tsx
M frontend/src/components/LoadingSkeleton.tsx
M frontend/src/hooks/useCatalog.ts
M frontend/src/lib/api.ts
M frontend/src/pages/HomePage.tsx
M frontend/src/styles/marketplace.css
M frontend/src/styles/responsive.css
M frontend/tests/marketplace.spec.ts
```
