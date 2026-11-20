# Backend milestone — catalog, schema, and merchandising

## Delivered scope

This implements the user's expanded backend request. It combines the API foundation, catalog/search/offer slice, complete relational purchase schema, and backend homepage queries. It does not mark the earlier React/authentication/checkout UI milestones complete.

The Laravel application lives in `backend/`. PostgreSQL migrations create users, categories, platforms, regions, sellers, product variants, independent offers, encrypted individual keys, carts/items, orders/items, simulated payment records, scheduled campaigns/offer membership, and homepage banners. All domain IDs are UUIDs; monetary values use integer EUR minor units.

Products belong to a platform and activation region and have many-to-many categories. Each offer belongs to one product and seller; unique product/seller pairs prevent duplicates. Ratings remain on the seller and are included in each offer resource. Public stock counts use unallocated/nonretired keys belonging to that exact offer, with active product/seller/offer eligibility.

Key values use Laravel's encrypted cast. A stable HMAC fingerprint catches duplicate plaintext keys across offers. Both ciphertext and fingerprints are hidden from model serialization and omitted from public resources. A composite FK prevents assigning a key to an order item for another offer. Model guards prevent replacing/reassigning allocated keys and editing purchase snapshots. PostgreSQL enforces prices, quantities, statuses, schedules, rating ranges, and allocation timestamps; cross-row checkout accounting will be owned by the future checkout action.

Controllers use Form Requests, API Resources, bounded pagination, stable sorts, and explicit GET routes. The shared product query supports partial title search and representative typos through pg_trgm. Word similarity uses SET LOCAL inside a short read transaction so reused connections retain their original settings after the transaction. The tests include a misspelled word in a long title, such as `wicher` → The Witcher 3: Wild Hunt.

Homepage banners, best sellers, deals, and promotions each invoke a dedicated query. Best sellers aggregate fulfilled order quantities in the last 30 days. Deals use SQL row numbering to select one discounted, stocked, currently promoted offer per product; displayed prices and comparison prices come from that same offer.

The transactional, repeatable seed includes **44 products / 132 offers**: 24 PC games, 12 console games, eight gift cards, three fictional rated sellers, nine categories, four platforms, two regions, three banners, two campaigns, a demo user/cart, and twelve consistent historical fulfilled demo orders. Forty-eight original local SVGs provide product and banner artwork. Prices/ratings are illustrative, and every key is fake and nonredeemable. No React data or components were introduced.

## Setup commands

The complete [setup guide](backend-setup.md) covers prerequisites, environment values, stable secrets, native and Docker paths, database startup, and troubleshooting. On this Windows workspace, from the repository root in PowerShell 7:

```powershell
.\scripts\setup-local.ps1
Set-Location .\backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan db:seed --no-interaction
& ..\.tools\php\php.exe artisan test --compact
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

The setup helper already migrates/seeds; explicit migrate/seed commands above are safe repeat runs. DatabaseSeeder invokes DemoMarketplaceSeeder. Initial generation of APP_KEY and KEY_FINGERPRINT_SECRET happens only when missing. Existing databases require their original keys.

With global PHP/Composer, use `composer install` from backend, configure the two databases, generate secrets once, then use the equivalent `php artisan` commands. No backend npm build is needed.

## Executed verification

Verified with PHP 8.4.28, Laravel 13.43.0, Sanctum 4.5.0, and a real PostgreSQL 18 cluster:

| Check | Result |
| --- | --- |
| Complete Windows setup helper rerun | Passed; existing environment file/secrets unchanged |
| Development `artisan migrate` | All six migrations applied |
| Development `artisan db:seed` | 44 products and 132 offers populated successfully |
| Isolated `marketplace_testing` rollback/reapply | All six migrations rolled back and reapplied successfully |
| Final `artisan test --compact` | **43 passed, 483 assertions** |
| Seed repeated twice in integration tests | Entity counts/available stock unchanged; historical orders/payments/keys remain consistent |
| `composer validate --strict` | Passed with synchronized lockfile |
| Compose / CI YAML syntax | Parsed successfully with Symfony YAML |
| Laravel Pint `--dirty --format agent` | Applied required formatting |
| `artisan route:list --path=api --except-vendor` | 13 implemented API routes |
| Real loopback HTTP requests | Readiness ready; catalog total 44; typo search found Elden Ring; detail contained 3 offers |
| Real homepage HTTP requests | 3 banners, 12 best sellers, 12 deals, 2 promotions |
| Real demo image HTTP request | 200 |

Tests cover model relationships, independent offers/ratings/stock, encrypted/hidden key material, duplicate fingerprints, cross-offer allocation rejection, quantity/money/rating constraints, immutable snapshots, category pivots, guest/account cart schema, filtering, sorting, pagination, partial/fuzzy search, validation/error envelopes, hidden products/sellers, homepage schedule boundaries, genuine deal selection, and recent fulfilled-sales ranking.

No checkout race/real-payment claim is made: checkout actions have not been implemented in this milestone. The temporary HTTP verification server was stopped afterward; the local PostgreSQL cluster remains available and can be stopped with the documented helper.

Docker Compose and GitHub Actions configuration were added. Docker is unavailable on this host; neither the container build nor hosted CI was executed. Native PostgreSQL tests and HTTP verification are the executed runtime path. No external hosting was provisioned.

## Incremental trade-offs

Use a modular Laravel application and PostgreSQL search to keep deployment and data consistency manageable. Derive stock from keys rather than maintaining counters. Keep ratings as seller metadata without introducing a review workflow. Keep promotions as scheduled offer collections; current and comparison prices remain independent seller-offer fields. Use deterministic demo fixtures without pretending to have live prices or official product artwork.

The next application milestone is Sanctum registration/login/logout plus guest/account cart actions and their ownership/CSRF tests. Atomic simulated checkout, order history, and owner-authorized key reveal follow. Schema/factories are ready, but those HTTP features are deliberately not exposed as placeholders.

## Changed-file manifest

The repository has no initial commit, so Git reports files as untracked. This inventory compares the observed M0 workspace with the final backend milestone: `M` identifies the six original planning files now updated; `A` identifies newly delivered files. Ignored dependency trees, local tools/databases, environment secrets, caches, and logs are excluded. The manifest below is generated from the actual nonignored repository files.

```text
A .github/workflows/backend.yml
A .gitignore
M README.md
A backend/.dockerignore
A backend/.editorconfig
A backend/.env.example
A backend/.gitattributes
A backend/.gitignore
A backend/AGENTS.md
A backend/CLAUDE.md
A backend/Dockerfile
A backend/README.md
A backend/app/Http/Controllers/Api/V1/CategoryController.php
A backend/app/Http/Controllers/Api/V1/HealthController.php
A backend/app/Http/Controllers/Api/V1/HomepageController.php
A backend/app/Http/Controllers/Api/V1/OfferController.php
A backend/app/Http/Controllers/Api/V1/ProductController.php
A backend/app/Http/Controllers/Controller.php
A backend/app/Http/Middleware/RequestId.php
A backend/app/Http/Requests/OfferIndexRequest.php
A backend/app/Http/Requests/PaginationRequest.php
A backend/app/Http/Requests/ProductIndexRequest.php
A backend/app/Http/Requests/SuggestionRequest.php
A backend/app/Http/Resources/BannerResource.php
A backend/app/Http/Resources/CategoryResource.php
A backend/app/Http/Resources/OfferResource.php
A backend/app/Http/Resources/ProductResource.php
A backend/app/Http/Resources/PromotionResource.php
A backend/app/Models/Cart.php
A backend/app/Models/CartItem.php
A backend/app/Models/Category.php
A backend/app/Models/Concerns/HasActiveWindow.php
A backend/app/Models/DigitalKey.php
A backend/app/Models/HomepageBanner.php
A backend/app/Models/Offer.php
A backend/app/Models/Order.php
A backend/app/Models/OrderItem.php
A backend/app/Models/PaymentAttempt.php
A backend/app/Models/Platform.php
A backend/app/Models/Product.php
A backend/app/Models/Promotion.php
A backend/app/Models/Region.php
A backend/app/Models/Seller.php
A backend/app/Models/User.php
A backend/app/Providers/AppServiceProvider.php
A backend/app/Queries/Catalog/ProductQuery.php
A backend/app/Queries/Home/BannersQuery.php
A backend/app/Queries/Home/BestSellersQuery.php
A backend/app/Queries/Home/DealsQuery.php
A backend/app/Queries/Home/PromotionsQuery.php
A backend/artisan
A backend/boost.json
A backend/bootstrap/app.php
A backend/bootstrap/cache/.gitignore
A backend/bootstrap/providers.php
A backend/composer.json
A backend/composer.lock
A backend/config/app.php
A backend/config/auth.php
A backend/config/cache.php
A backend/config/database.php
A backend/config/filesystems.php
A backend/config/logging.php
A backend/config/mail.php
A backend/config/marketplace.php
A backend/config/queue.php
A backend/config/services.php
A backend/config/session.php
A backend/database/.gitignore
A backend/database/factories/CartFactory.php
A backend/database/factories/CartItemFactory.php
A backend/database/factories/CategoryFactory.php
A backend/database/factories/DigitalKeyFactory.php
A backend/database/factories/HomepageBannerFactory.php
A backend/database/factories/OfferFactory.php
A backend/database/factories/OrderFactory.php
A backend/database/factories/OrderItemFactory.php
A backend/database/factories/PaymentAttemptFactory.php
A backend/database/factories/PlatformFactory.php
A backend/database/factories/ProductFactory.php
A backend/database/factories/PromotionFactory.php
A backend/database/factories/RegionFactory.php
A backend/database/factories/SellerFactory.php
A backend/database/factories/UserFactory.php
A backend/database/migrations/0001_01_01_000000_create_users_table.php
A backend/database/migrations/0001_01_01_000001_create_cache_table.php
A backend/database/migrations/0001_01_01_000002_create_jobs_table.php
A backend/database/migrations/2026_11_19_174202_create_catalog_tables.php
A backend/database/migrations/2026_11_19_174203_create_commerce_tables.php
A backend/database/migrations/2026_11_19_174204_create_merchandising_tables.php
A backend/database/seeders/DatabaseSeeder.php
A backend/database/seeders/DemoMarketplaceSeeder.php
A backend/database/seeders/data/products.json
A backend/docker/entrypoint.sh
A backend/phpunit.xml
A backend/public/.htaccess
A backend/public/demo/animal-crossing-new-horizons-nintendo-eu.svg
A backend/public/demo/baldur-s-gate-3-steam-global.svg
A backend/public/demo/banner-deals.svg
A backend/public/demo/banner-discover.svg
A backend/public/demo/banner-gift-cards.svg
A backend/public/demo/celeste-steam-global.svg
A backend/public/demo/cities-skylines-steam-global.svg
A backend/public/demo/cyberpunk-2077-steam-global.svg
A backend/public/demo/dark-souls-iii-steam-global.svg
A backend/public/demo/dead-cells-steam-global.svg
A backend/public/demo/diablo-iv-xbox-global.svg
A backend/public/demo/disco-elysium-the-final-cut-steam-global.svg
A backend/public/demo/doom-eternal-steam-global.svg
A backend/public/demo/elden-ring-steam-global.svg
A backend/public/demo/euro-truck-simulator-2-steam-global.svg
A backend/public/demo/forza-horizon-5-xbox-global.svg
A backend/public/demo/gears-5-xbox-global.svg
A backend/public/demo/generic.svg
A backend/public/demo/hades-steam-global.svg
A backend/public/demo/halo-infinite-campaign-xbox-global.svg
A backend/public/demo/hogwarts-legacy-steam-global.svg
A backend/public/demo/hollow-knight-steam-global.svg
A backend/public/demo/mario-kart-8-deluxe-nintendo-eu.svg
A backend/public/demo/microsoft-flight-simulator-standard-edition-xbox-global.svg
A backend/public/demo/minecraft-xbox-one-edition-xbox-global.svg
A backend/public/demo/nintendo-eshop-eur-15-nintendo-eu.svg
A backend/public/demo/nintendo-eshop-eur-25-nintendo-eu.svg
A backend/public/demo/no-man-s-sky-steam-global.svg
A backend/public/demo/ori-and-the-will-of-the-wisps-xbox-global.svg
A backend/public/demo/playstation-store-eur-10-playstation-eu.svg
A backend/public/demo/playstation-store-eur-20-playstation-eu.svg
A backend/public/demo/portal-2-steam-global.svg
A backend/public/demo/red-dead-redemption-2-steam-global.svg
A backend/public/demo/resident-evil-4-steam-global.svg
A backend/public/demo/sea-of-thieves-xbox-global.svg
A backend/public/demo/sekiro-shadows-die-twice-steam-global.svg
A backend/public/demo/sid-meier-s-civilization-vi-steam-global.svg
A backend/public/demo/slay-the-spire-steam-global.svg
A backend/public/demo/stardew-valley-steam-global.svg
A backend/public/demo/steam-wallet-eur-10-steam-eu.svg
A backend/public/demo/steam-wallet-eur-20-steam-eu.svg
A backend/public/demo/subnautica-steam-global.svg
A backend/public/demo/super-mario-odyssey-nintendo-eu.svg
A backend/public/demo/terraria-steam-global.svg
A backend/public/demo/the-legend-of-zelda-breath-of-the-wild-nintendo-eu.svg
A backend/public/demo/the-witcher-3-wild-hunt-steam-global.svg
A backend/public/demo/xbox-gift-card-eur-10-xbox-eu.svg
A backend/public/demo/xbox-gift-card-eur-25-xbox-eu.svg
A backend/public/favicon.ico
A backend/public/index.php
A backend/public/robots.txt
A backend/routes/api.php
A backend/routes/console.php
A backend/routes/web.php
A backend/storage/app/.gitignore
A backend/storage/app/private/.gitignore
A backend/storage/app/public/.gitignore
A backend/storage/framework/.gitignore
A backend/storage/framework/cache/.gitignore
A backend/storage/framework/cache/data/.gitignore
A backend/storage/framework/cache/locks/.gitignore
A backend/storage/framework/sessions/.gitignore
A backend/storage/framework/testing/.gitignore
A backend/storage/framework/views/.gitignore
A backend/storage/logs/.gitignore
A backend/tests/Feature/CatalogApiTest.php
A backend/tests/Feature/DemoSeederTest.php
A backend/tests/Feature/ExampleTest.php
A backend/tests/Feature/HomepageApiTest.php
A backend/tests/Feature/MarketplaceSchemaTest.php
A backend/tests/TestCase.php
A compose.yaml
M docs/ai-chat-history.md
M docs/api-design.md
M docs/architecture.md
A docs/backend-milestone.md
A docs/backend-setup.md
M docs/database-schema.md
M docs/implementation-plan.md
A scripts/bootstrap-windows.ps1
A scripts/create-local-databases.php
A scripts/init-test-database.sql
A scripts/local-database.ps1
A scripts/setup-local.ps1
```
