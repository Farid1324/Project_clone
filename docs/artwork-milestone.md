# Complete catalog artwork verification

All **45 seeded listings have valid original demo covers**: 37 games and eight gift cards use 44 distinct portrait assets. The Global and US Stardew Valley listings intentionally share one cover. All three homepage banners and both promotion records reference valid local images. Together they use 47 distinct image URLs. These are original illustrative demo title covers, not licensed official publisher box art.

No seeded artwork was missing in this follow-up. The change adds consistent handling for an unexpected missing/empty image URL, so the application displays an honest local artwork-unavailable illustration instead of a broken-image icon. It does not assign the fallback to products or replace valid covers.

## Changed files and behavior

- frontend/src/components/MarketplaceImage.tsx centralizes image loading failure handling and preserves dimensions, lazy loading, priority and alt text. State resets when the backend returns a different image URL, allowing a repaired cover to recover without a full reload.
- ProductCard, ProductPage, SearchBar, CartPage and HeroBanner use that shared component. All product/banner data still comes from Laravel.
- backend/public/demo/cover-unavailable.svg is a bundled original fallback; no external image host or new dependency is required.
- frontend/tests/artwork.spec.ts adds seven focused browser tests. The [changed-file manifest](artwork-changed-files.json) lists the full milestone scope; [verification JSON](artwork-verification.json) records results.

## Verification

**Passed: 85 browser tests, including seven new artwork tests; TypeScript, lint and production build.** There were no failed, skipped or flaky browser tests in the final run. [Live catalog capture](ui-screenshots/keymarket-covers-mobile-live.jpg).

The focused tests decode every catalog cover at 1440px and 390px, visit all 45 product-detail pages and decode their portrait covers, exercise empty/broken image URLs and recovery, check search/cart/detail fallbacks, and confirm that hero text/carousel navigation remain usable during an artwork failure. The preexisting media audit also checks HTTP status, MIME type, same-origin URLs and nonempty bytes.

The first rapid sweep against the ordinary preview hit its 120-request-per-minute catalog limit. This was an API throttle response, not a missing image. Automated verification therefore uses a separate local QA server with process-local cache and a reduced fixture hashing cost. Normal preview and deployment settings retain their normal rate limits/password cost. The test suite creates disposable users/orders and consumes demo inventory in its existing purchasing tests; it must not target production.

## Run and reproduce

From the repository root:

```powershell
npm.cmd run lint --prefix frontend
npm.cmd run typecheck --prefix frontend
npm.cmd run build --prefix frontend
.\scripts\build-single-origin.ps1 -SkipBuild
```

In a separate QA terminal:

```powershell
$env:CACHE_STORE='array'
$env:BCRYPT_ROUNDS='4'
Set-Location backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8010
```

In the test terminal:

```powershell
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8010'
Set-Location frontend
npx.cmd playwright test tests/artwork.spec.ts
# Full regression:
npm.cmd run test:e2e
```

No migration, reseeding, additional dependency or artwork download is needed. Existing data and encryption keys are retained. The running Vite preview at http://127.0.0.1:5173 picks up the component change; the build script updates the compiled single-origin preview. This milestone changes no PHP business logic, so backend transaction/auth tests were not repeated for an image-rendering change. Their previously verified results remain in the submission report.
