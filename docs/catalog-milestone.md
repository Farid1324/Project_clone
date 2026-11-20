# Catalog and global search milestone

Delivered November 20, 2026. This extends the existing database-backed store and global search with popularity sorting, a stocked US regional listing, complete URL page-size handling, out-of-range page recovery, and deeper PostgreSQL/browser regression coverage. Existing working filters and autocomplete are retained.

## Implemented catalog behavior

`GET /api/v1/products` reads PostgreSQL through ProductQuery and returns a paginated ProductResource collection. The store renders that returned page directly; it does not search, filter or sort a frontend product array.

| Input | Semantics |
| --- | --- |
| q | Trimmed case-insensitive product-title search, up to 100 characters |
| platforms[] | Backend platform slugs such as steam, xbox, playstation, nintendo |
| regions[] | Backend activation codes GLOBAL, EU, US |
| categories[] | Backend category slugs |
| price_min / price_max | Integer EUR cents; both bounds must match the same available seller offer |
| sort | relevance, price_asc, price_desc, popularity, newest, title_asc |
| page / per_page | Positive page; page size 1–48, API default 24, store default 20 |
| in_stock | Defaults true; false also includes published sold-out products with unavailable/null prices |
| type / promotion | Existing product-type and active-promotion filters remain supported |

Values inside one facet use OR; different facets, search and price constraints combine with AND. A product matching two categories or several seller offers is still one paginated row. The displayed price is the lowest price among qualifying offers. For example, offers at €5 and €40 cannot satisfy a €20–€30 range; a separate stocked offer at €22 can.

Price sorts use the current qualifying minimum price, with unavailable prices last. Popularity sums fulfilled order-item quantities across sellers during the last 30 days, excludes failed/older/future orders, and leaves unsold eligible products visible with zero sales. Ties use creation time descending and product ID. Newest means catalog creation time; every sort has a stable final ID tie-break.

The shared RecentSalesQuery moved to `app/Queries/Catalog/` so the catalog and homepage services use the same sales definition without a catalog dependency on homepage providers.

## PostgreSQL search and relevance

Store search and `GET /api/v1/search/suggestions?q=...` call the same ProductQuery search implementation. Candidate predicates use bound values and indexed lower(title). For terms of at least three characters, candidates include literal substrings, whole-title trigram matches and word-similarity matches. Results rank by exact title, title prefix, literal substring, then fuzzy candidates; word similarity and product ID resolve remaining ties.

One/two-character store terms use title-prefix matching. Suggestions start at two characters, support a limit of 1–8, and default to eight. This bounds short-query work while supporting broader substring/typo matches as the user types. Trigram matching is approximate, not a guarantee of arbitrary spelling correction.

The original catalog migration already installs pg_trgm and both appropriate expression indexes:

```sql
CREATE INDEX products_title_trigram
  ON products USING GIN (lower(title) gin_trgm_ops);
CREATE INDEX products_title_prefix
  ON products (lower(title) text_pattern_ops);
```

These indexes are reused rather than duplicated. pg_trgm supports similarity and substring candidate predicates; patterns without useful trigrams are less selective, which motivates the short-query prefix policy. The small demo may legitimately use sequential scans; no large-catalog latency or forced index-plan claim is made. [PostgreSQL 18 pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html).

Each search pins whole-title similarity to 0.3 and word similarity to 0.4 in a short transaction. Prior connection values are restored on success, including an existing outer transaction; PostgreSQL rollback restores them if the operation fails. Tests verify that custom session settings survive a search. LIKE wildcards are escaped and SQL values are bound.

Both endpoints exclude unpublished products and offers that are inactive, sold out, retired or owned by suspended sellers. The tests cover `minecraf`, the actual typo `mincraft`, `elden`, `eldn ring`, case differences, interior-name matches and relevance ordering. Full search and suggestions return the same ordered candidates at equivalent limits.

## React state and navigation

SearchBar is mounted in the shared header on home, store, product, about and handled 404 pages. Desktop displays the field; mobile exposes it through the labeled search control. It debounces requests by 250ms, consumes AbortSignal, ignores superseded terms, and uses a labeled combobox/listbox with arrow navigation, Enter selection and Escape dismissal. Submitting without selecting a suggestion opens the backend-searched store.

React Router query parameters own store state. Facets, prices, sort and page restore through direct links, reload and Back. Changing a filter or sort resets the page while preserving other selections. The store now honors per_page from the URL instead of always replacing it with 20. A valid out-of-range page has a first-page recovery action that preserves the search and filters.

React Query owns API state, cache keys and cancellation. Existing skeletons, empty/error states and retry controls remain. Invalid filters get the standard backend 422 envelope; empty results contain no invented products. Product cards always navigate using the API slug.

Example combined store URL:

```text
/store?q=stardew&platforms[]=steam&regions[]=US&categories[]=indie&price_min=1000&price_max=1500&sort=price_asc&per_page=1
```

The corresponding API request uses the same query parameters under `/api/v1/products`.

## Seed and setup

The repeatable seed now has **45 listings / 135 offers**: 25 PC game variants, 12 console games and eight gift cards, with Global/Europe/US activation regions. A US Stardew Valley variant provides a real positive US-filter result. Each regional listing has independent inventory/offers and its own detail slug. Its backend artwork_slug reuses the existing original cover; React contains no listing fixture or asset override. The existing 16 historical demo orders remain repeatable.

No new migration or package dependency is required; the original migrations supply the indexes. From the root, use the existing PHP/Composer/PostgreSQL toolchain and Node.js 24:

```powershell
.\scripts\setup-local.ps1
npm.cmd ci --prefix frontend
Set-Location backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan db:seed --no-interaction
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

In another root terminal, run `npm.cmd run dev --prefix frontend` and open [the store](http://127.0.0.1:5173/store?sort=popularity). Existing installations can restart PostgreSQL with `.\scripts\local-database.ps1 start` and rerun only the seeder. Keep existing .env encryption secrets. [Global toolchain/Docker backend setup](backend-setup.md).

The portable Windows database helper now starts with 32MB shared_buffers and 20 max_connections for this small development workload. A host memory-commit failure interrupted an earlier browser attempt; these local startup settings reduce the database footprint. Existing running clusters must be stopped and started through the helper for new startup flags to apply. This is development configuration, not production capacity guidance.

## Verification

**70 backend tests / 742 assertions passed** against PostgreSQL. The catalog/search/seed subset separately passed 41 tests / 584 assertions.

**55 Chromium browser tests passed** in the final full run, with no skipped, flaky or unexpected results. This includes eight axe scans across home/store/about/product at desktop/mobile widths with zero reported WCAG 2/2.1/2.2 A/AA violations. Lint, TypeScript/Vite production build, Pint and installed-index checks passed.

[Verification snapshot](catalog-verification.json) preserves actual browser test names, statuses and timings. The final suite ran after the local database/preview environment recovered; earlier interrupted attempts are not counted as clean runs.

Commands from the root:

```powershell
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
Set-Location backend
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
& ..\.tools\php\php.exe artisan test --compact
```

For browser tests on this portable Windows runtime, keep PostgreSQL running and start the opcode-cached local QA server from the root:

```powershell
$env:CACHE_STORE = 'array'
Set-Location backend/public
& ..\..\.tools\php\php.exe -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8000 ..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php
```

Then in another root terminal:

```powershell
Set-Location frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run capture:local
```

The array cache is process-local QA configuration for rate-counter isolation; application defaults remain in source configuration. Playwright starts or reuses Vite and requires a healthy real API. All successful catalog/search flows use seeded PostgreSQL responses. Existing deliberate homepage failure/loading fixtures remain isolated to their tests.

Coverage includes combined search/platform/region/category/price filters; OR/AND semantics; multiple seller offers; price directions, popularity and newest; complete pagination without duplicates; exact/prefix/substring/fuzzy relevance; SQL escaping; settings restoration; index installation; visibility/stock; suggestion validation; URL reload/Back; page-size preservation and page reset; out-of-range recovery; one request after rapid typing; stale search cancellation; and desktop/mobile global search from all page types.

[Desktop store screenshot](ui-screenshots/keymarket-store-desktop-1440.png), [mobile store screenshot](ui-screenshots/keymarket-store-mobile-390.png), and [capture measurements](ui-screenshots/observations.json) were refreshed. All seven route/viewport captures have no horizontal overflow, missing images or page errors.

The prior milestone reports remain historical snapshots. Current screenshot paths are refreshed by the capture script. Preview servers used for verification are stopped at handoff. No production deployment, cross-browser/device certification or large-catalog performance benchmark is claimed.

## Changed files

Relative to the preceding homepage milestone. This repository has no initial commit; statuses are derived from a pre-edit file hash snapshot, not Git HEAD. A = added, M = modified, D = moved/retired. Local tools, dependencies, secrets, traces and build output are excluded.

37 changed paths: 5 added, 1 retired/moved and 31 modified.

```text
A backend/app/Queries/Catalog/RecentSalesQuery.php
A backend/tests/Feature/CatalogSearchTest.php
A docs/catalog-milestone.md
A docs/catalog-verification.json
A frontend/tests/catalog-search.spec.ts
D backend/app/Queries/Home/RecentSalesQuery.php
M README.md
M backend/app/Http/Requests/ProductIndexRequest.php
M backend/app/Queries/Catalog/ProductQuery.php
M backend/app/Services/Home/BestSellerService.php
M backend/app/Services/Home/GiftCardService.php
M backend/app/Services/Home/PopularCategoryService.php
M backend/database/seeders/DemoMarketplaceSeeder.php
M backend/database/seeders/data/products.json
M backend/tests/Feature/CatalogApiTest.php
M backend/tests/Feature/DemoSeederTest.php
M docs/ai-chat-history.md
M docs/api-design.md
M docs/architecture.md
M docs/artwork-provenance.md
M docs/backend-setup.md
M docs/database-schema.md
M docs/implementation-plan.md
M docs/ui-screenshots/keymarket-home-desktop-1440-full.png
M docs/ui-screenshots/keymarket-home-mobile-390-full.png
M docs/ui-screenshots/keymarket-home-tablet-768-full.png
M docs/ui-screenshots/keymarket-product-desktop-1440-full.png
M docs/ui-screenshots/keymarket-product-desktop-1440.png
M docs/ui-screenshots/keymarket-product-mobile-390-full.png
M docs/ui-screenshots/keymarket-product-mobile-390.png
M docs/ui-screenshots/keymarket-store-desktop-1440-full.png
M docs/ui-screenshots/keymarket-store-desktop-1440.png
M docs/ui-screenshots/keymarket-store-mobile-390-full.png
M docs/ui-screenshots/keymarket-store-mobile-390.png
M frontend/README.md
M frontend/src/pages/StorePage.tsx
M scripts/local-database.ps1
```
