# UI milestone — responsive marketplace browsing

Delivered November 19, 2026, on the existing Laravel/PostgreSQL backend. This user-directed slice implements the React/TypeScript/Vite application, Tailwind design system, independent homepage sections, searchable catalog, product/seller comparison and responsive shell. It covers the frontend portions of roadmap M1, M2 and M5.

## What changed and why

All ten requested components are reusable TypeScript modules under `frontend/src/components/`:

| Component | Responsibility and real interaction |
| --- | --- |
| Header | Original brand, global search, mobile search/menu controls, working About link and visible demo strip |
| Navigation | Internal discovery/catalog/gift/deal routes and backend-driven platform links |
| SearchBar | Debounced partial/typo suggestions, keyboard listbox selection, Enter-to-store and clear/dismiss controls |
| HeroBanner | API-managed title/art/subtitle/destination, manual preview/dot navigation and real CTA |
| CategoryNavigation | Backend categories, icon mapping and genuine facet links; scrolls horizontally on narrow screens |
| ProductCard | Shared backend product rendering: artwork, platform/region, discount, price and available-offer count; links to detail |
| ProductGrid | One responsive collection component with catalog and compact mobile recommendation variants |
| SellerOfferCard | Independent seller price, rating, stock and expandable activation information |
| Footer | Actual catalog/platform/help links and independent-demo identity |
| LoadingSkeleton | Accessible busy presentation for cards, lines and hero; no invented product data |

Supporting components share the brand, native Dialog, FilterPanel, PlatformBadge and error/retry state. Pages compose these pieces rather than duplicate card or filter markup. Small supporting modules live in `hooks/`, `lib/`, `types/` and `styles/`; [the design guide](ui-design-system.md) describes theme tokens and measured geometry.

Routes: `/`, `/store`, `/products/:slug`, `/about`, plus an explicit recovery page for unknown URLs. Product API 404s get a product-specific recovery state. Route rendering errors have a real reload action.

## Backend integration and state

The homepage queries banners, best sellers, deals and promotions independently through `/api/v1/home/*`. Categories use `/api/v1/catalog/filters`. Every section has its own loading, empty, error and retry behavior. Product titles, images, regions, prices, ratings and promotion contents come from Laravel; there is no React fixture catalog or fallback offer data.

TanStack Query owns request caching, cancellation and errors. Search waits 250ms and passes AbortSignal to fetch. Superseded queries cannot replace the current term. A keyed search-input boundary resets local typing when the URL search changes without a synchronization effect. Navigation/filter changes use React Router's data router; synchronous navigation prevents controlled checkboxes briefly reverting before the URL update commits.

The store URL is the source of truth for search, repeated category/platform/region facets, price range, sort and page. Filter changes reset pagination; Back restores previous state. Native number inputs validate basic bounds; the price form checks min/max order and converts euros to integer cents. Laravel remains authoritative for validation and eligibility.

The Vite proxy forwards `/api`, `/sanctum` and `/demo` to Laravel, preserves the client host for same-origin image URLs, and serializes upstream HTTP connections to avoid stalls in Windows PHP's single-threaded development server. This local constraint is not a production concurrency design.

The only PHP source modification switches seeded banner/promotion assets to original UI artwork and corrects product copy to state that purchasing is not enabled. Existing migrations, product counts, offer eligibility, stock computation, secrets and allocations remain intact. Run the normal seeder to refresh an already initialized development database.

## Run

Prerequisites: Node.js 24 LTS and the existing backend toolchain. From the repository root in PowerShell 7:

```powershell
.\scripts\setup-local.ps1
npm.cmd ci --prefix frontend
Set-Location backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

In another root terminal:

```powershell
npm.cmd run dev --prefix frontend
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). `API_PROXY_TARGET` defaults to `http://127.0.0.1:8000`; `frontend/.env.example` documents the optional override. No extra migration was introduced. To update existing seeded banner paths/copy without resetting data:

```powershell
Set-Location backend
& ..\.tools\php\php.exe artisan migrate
& ..\.tools\php\php.exe artisan db:seed
```

Preserve existing environment secrets and inventory. See [backend setup](backend-setup.md) for global toolchain, Docker and database details. The existing Compose/CI files are backend-only; no unverified frontend container or CI service is claimed.

## Tests and actual results

Executed on Windows with PostgreSQL 18 and real Laravel API responses, November 19, 2026:

| Check | Result |
| --- | --- |
| `npm.cmd run lint --prefix frontend` | Passed, no warnings |
| `npm.cmd run build --prefix frontend` | Passed TypeScript project build and production Vite bundling |
| `npm.cmd run test:e2e` from frontend | **23 passed**, no skipped/flaky/unexpected tests |
| Axe WCAG 2 A/AA, 2.1 AA, 2.2 AA | Eight scans: home/store/about/product at 1440 and 390px, zero reported violations |
| `php artisan test --compact tests/Feature/DemoSeederTest.php tests/Feature/HomepageApiTest.php` | **7 passed / 296 assertions** after seeder changes |
| `php vendor/bin/pint --dirty --format agent` | Passed |
| Local screenshot audit | Seven route/viewport captures; no page errors, unloaded images or horizontal page overflow |

[Verification snapshot](ui-verification.json) preserves the final browser run's actual test titles, statuses and timings. The preceding backend milestone's full 43-test / 483-assertion run is historical evidence, not a claim that the entire backend suite was rerun for this UI slice.

Browser coverage includes independent homepage requests; 1440/768/390 layout; hero navigation/CTA; typo suggestion keyboard navigation; stale-query cancellation; submitted search, URL filters and price validation; price sorting against real rendered values; pagination/Back; mobile search/menu/filter focus; isolated section failure/retry; loading and empty states; native seller details; recovery links; skip-link focus; and accessibility scanning.

To reproduce, keep Laravel running and PostgreSQL seeded:

```powershell
Set-Location frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run capture:local
npm.cmd run capture:reference
```

Playwright starts/reuses Vite. It checks API health before tests. Only explicit loading/empty/failure tests intercept responses; successful flows use the real database. One worker is intentional for local PHP. Failure traces/screenshots and raw JSON remain in ignored `frontend/test-results/`. Reference capture accesses an external changing website and is review tooling, not an assertion in the test suite.

The final production bundle is approximately 396KB JavaScript (123KB gzip) and 37KB CSS (8KB gzip), excluding locally bundled fonts and artwork. The straightforward shared client bundle suits this milestone; route splitting and image derivatives can follow measured performance needs.

## Visual review, artwork and limits

[Design system and comparison](ui-design-system.md) links actual official and implemented screenshots and explains specific measurements/differences. Home was compared at 1440 and 390px; desktop store/product references were also inspected. Official mobile store/product routes returned a security challenge, recorded without bypassing it. Local home/store/product pages were all captured at both widths, plus tablet home. Screenshots wait for fonts, API content and loaded images before capture.

[Artwork provenance](artwork-provenance.md) records original SVGs, the generated fantasy banner, exact prompt, font/icon licenses and separation of third-party reference screenshots from application assets.

This is a polished browsing milestone. Authentication, cart mutation, simulated checkout, order history and key reveal remain future work. The interface exposes no dummy purchase/account actions. No live payments, screen-reader certification, Safari/Firefox/mobile-device run, production deployment, Docker execution or frontend CI execution is claimed. The owned preview servers were used for verification and are stopped during handoff; use the commands above to reopen the application.

## Complete changed-file manifest

Status is relative to the preceding backend milestone, not Git HEAD: the repository has no initial commit, so Git reports the entire project as untracked. `A` means introduced in this UI milestone; `M` means an existing project file changed. Generated build output, dependencies, secrets, traces and local tools are excluded. Unreferenced Vite starter assets remain present after automatic approval review rejected their cleanup; they are included below and do not appear in the application.

83 added files; 5 modified files.

```text
A backend/public/demo/banner-deals-v2.svg
A backend/public/demo/banner-discover-v2.png
A backend/public/demo/banner-gift-cards-v2.svg
A docs/artwork-provenance.md
A docs/ui-design-system.md
A docs/ui-milestone.md
A docs/ui-reference/eneba-desktop-1440.png
A docs/ui-reference/eneba-mobile-390.png
A docs/ui-reference/eneba-product-desktop-1440.png
A docs/ui-reference/eneba-product-mobile-390.png
A docs/ui-reference/eneba-store-desktop-1440.png
A docs/ui-reference/eneba-store-mobile-390.png
A docs/ui-reference/observations.json
A docs/ui-screenshots/keymarket-home-desktop-1440-full.png
A docs/ui-screenshots/keymarket-home-desktop-1440.png
A docs/ui-screenshots/keymarket-home-mobile-390-full.png
A docs/ui-screenshots/keymarket-home-mobile-390.png
A docs/ui-screenshots/keymarket-home-tablet-768-full.png
A docs/ui-screenshots/keymarket-home-tablet-768.png
A docs/ui-screenshots/keymarket-product-desktop-1440-full.png
A docs/ui-screenshots/keymarket-product-desktop-1440.png
A docs/ui-screenshots/keymarket-product-mobile-390-full.png
A docs/ui-screenshots/keymarket-product-mobile-390.png
A docs/ui-screenshots/keymarket-store-desktop-1440-full.png
A docs/ui-screenshots/keymarket-store-desktop-1440.png
A docs/ui-screenshots/keymarket-store-mobile-390-full.png
A docs/ui-screenshots/keymarket-store-mobile-390.png
A docs/ui-screenshots/observations.json
A docs/ui-verification.json
A frontend/.env.example
A frontend/.gitignore
A frontend/.oxlintrc.json
A frontend/README.md
A frontend/index.html
A frontend/package-lock.json
A frontend/package.json
A frontend/playwright.config.ts
A frontend/public/favicon.svg
A frontend/public/icons.svg
A frontend/public/keymarket.svg
A frontend/scripts/capture-local.mjs
A frontend/scripts/capture-reference.mjs
A frontend/src/App.css
A frontend/src/App.tsx
A frontend/src/assets/hero.png
A frontend/src/assets/react.svg
A frontend/src/assets/vite.svg
A frontend/src/components/AsyncState.tsx
A frontend/src/components/Brand.tsx
A frontend/src/components/CategoryNavigation.tsx
A frontend/src/components/Dialog.tsx
A frontend/src/components/FilterPanel.tsx
A frontend/src/components/Footer.tsx
A frontend/src/components/Header.tsx
A frontend/src/components/HeroBanner.tsx
A frontend/src/components/LoadingSkeleton.tsx
A frontend/src/components/Navigation.tsx
A frontend/src/components/PlatformBadge.tsx
A frontend/src/components/ProductCard.tsx
A frontend/src/components/ProductGrid.tsx
A frontend/src/components/SearchBar.tsx
A frontend/src/components/SellerOfferCard.tsx
A frontend/src/hooks/useCatalog.ts
A frontend/src/hooks/usePageTitle.ts
A frontend/src/index.css
A frontend/src/lib/api.ts
A frontend/src/lib/format.ts
A frontend/src/main.tsx
A frontend/src/pages/AboutPage.tsx
A frontend/src/pages/HomePage.tsx
A frontend/src/pages/ProductPage.tsx
A frontend/src/pages/StorePage.tsx
A frontend/src/styles/catalog.css
A frontend/src/styles/layout.css
A frontend/src/styles/marketplace.css
A frontend/src/styles/responsive.css
A frontend/src/styles/tokens.css
A frontend/src/types/api.ts
A frontend/tests/marketplace.spec.ts
A frontend/tsconfig.app.json
A frontend/tsconfig.json
A frontend/tsconfig.node.json
A frontend/vite.config.ts
M .gitignore
M README.md
M backend/database/seeders/DemoMarketplaceSeeder.php
M docs/ai-chat-history.md
M docs/implementation-plan.md
```
