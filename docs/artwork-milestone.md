# Real catalog artwork and image rendering — November 23, 2026

All 45 seeded listings now use matching local artwork: 36 game covers shared by 37 game variants, plus eight appropriate gift-card demo compositions. Nothing in the seeded catalog remains assigned generic geometry or the unavailable fallback. All 44 final assets were visually reviewed against their titles and editions. [Exact source pages, image URLs and selection notes](artwork-provenance.md) · [Machine-readable provenance](../backend/database/seeders/data/cover-artwork.json).

## Diagnosis

The baseline API referenced 44 distinct symbolic SVG title cards for 45 listings. Every URL returned HTTP 200 with image/svg+xml; all catalog images decoded after scrolling at desktop and mobile widths. The sparse abstract imagery was the seeded content, rather than an empty network response. Browser measurements found visible block images with opacity 1 and reserved layout space; no reproducible CSS visibility, lazy-loading, bad MIME or 404 defect was found locally.

The native Laravel preview sends no CSP header. The production Nginx configuration restricts images to self/data; the replacement files are local, so no external-host CSP exception is needed. The running production CSP was not exercised for this update. Existing Vite /demo proxy routing is retained.

Two concrete rendering weaknesses were addressed: the old 3:4 geometry would crop the downloaded 2:3 portraits, including compact mobile best-seller rows; and failure of the fallback SVG itself could still leave a broken image. These were corrected even though the original local covers returned successfully.

## Changes

- Downloaded and optimized 44 WebP assets into backend/public/demo/covers, all 600×900. Total output is 3,871,910 bytes versus 8,628,611 source bytes (55.1% reduction). Full cover titles/branding are retained through containing/letterboxing; only documented retailer white margins were removed. Gift-card art is a labeled demo composition with the exact seeded EUR value.
- products.json owns every seeded cover path. The full demo seeder uses those paths for fresh installations. The image-only ProductArtworkSeeder updates existing matching slugs in a transaction under the same advisory lock as the demo seeder. It updates only cover_image_path and its normal updated_at timestamp, does not create products, and skips unchanged rows on reruns.
- MarketplaceImage still handles primary errors and empty URLs through the bundled local SVG. If the SVG also fails, it renders a visible HTML Artwork unavailable state with no image to retry. Changing the API URL resets failure state. Decorative card/search images remain labeled through adjacent titles; standalone detail/cart artwork retains useful alternative text.
- Shared card, detail, cart, autocomplete and skeleton geometry now preserves 2:3. Width/height reserve space, eager detail/hero priorities and lazy card loading remain appropriate, and mobile rows retain the complete cover. Hero fallback positioning also works for the terminal HTML state.
- Footer/About copy distinguishes third-party game artwork, gift-card demo compositions and original promotional illustrations. No external API requests or credentials are needed at runtime.
- The former 45-navigation detail sweep with a 90-second timeout is split into five disjoint batches of about nine products, each with a 45-second budget. All original source/decode/portrait/no-fallback assertions remain. The list-size assertion fails rather than silently omitting a page if the seed catalog grows.

## Safe update and reproduction

From the repository root, with the existing PostgreSQL database running:

```powershell
Set-Location backend
& ..\.tools\php\php.exe artisan db:seed --class=ProductArtworkSeeder --no-interaction
Set-Location ..
npm.cmd ci --prefix frontend
.\scripts\build-single-origin.ps1
Set-Location backend
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

Open http://127.0.0.1:8000. For Vite hot reload, separately run npm.cmd run dev --prefix frontend and open http://127.0.0.1:5173. A fresh installation uses the README's normal migrations and demo seeding. Existing installations need **no new migration and no full reseed** for this update. Never use migrate:fresh or regenerate encryption secrets on persistent data. With global runtimes replace the portable PHP path with php. In production deploy the new public assets first, then run php artisan db:seed --class=ProductArtworkSeeder --force --no-interaction.

The image-only backfill was executed on the existing local database. Before/after table counts and full-content fingerprints matched for users, offers, digital_keys, carts, cart_items, orders, order_items, payment_attempts and wishlist_items. Product metadata excluding cover path/updated_at also matched. At that moment this preserved 146 users, 135 offers, 641 keys and 92 orders, including allocated inventory. Later browser tests legitimately create more disposable accounts, carts and purchases; those test mutations are separate from the backfill. The backend regression tests also prove repeatability, preservation of edited prices/publication state and no fixture creation in an empty database.

## Verification commands

```powershell
Set-Location backend
& ..\.tools\php\php.exe artisan test --compact --filter='ProductArtworkTest|DemoSeederTest'
& ..\.tools\php\php.exe artisan test --compact
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
Set-Location ..\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
# Keep a compiled QA Laravel server and development PostgreSQL running:
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8000'
npx.cmd playwright test
```

For the rapid full browser sweep, use README's separate QA server with process-only CACHE_STORE=array and BCRYPT_ROUNDS=4. Do not apply those fixture settings to a public deployment. Backend tests run only in guarded marketplace_testing. Browser purchasing tests consume demo stock and create disposable accounts; run only against development fixtures. The two final shared-surface cases can also be run with npx.cmd playwright test tests/artwork.spec.ts --grep 'render the selected real cover'.

Actual results and execution limits are recorded in [cover-artwork-verification.json](cover-artwork-verification.json). [Changed-file manifest](cover-artwork-changed-files.json) separates this task from preexisting wishlist/deployment work. The old artwork-verification.json and artwork-changed-files.json describe the preceding symbolic-cover milestone and are historical evidence.

## Screenshots and review

- [Desktop store, full page](ui-screenshots/keymarket-real-covers-store-1440.png) and [viewport crop](ui-screenshots/keymarket-real-covers-store-1440-crop.png).
- [Mobile store, full page](ui-screenshots/keymarket-real-covers-store-390.png) and [top crop](ui-screenshots/keymarket-real-covers-store-390-crop.png).
- [Desktop homepage](ui-screenshots/keymarket-real-covers-home-1440.png) and [mobile homepage](ui-screenshots/keymarket-real-covers-home-390.png), captured after scrolling to load lazy images.
- [All 44 final assets](ui-screenshots/keymarket-real-covers-contact.jpg), a contact sheet for visual title/edition review, not a browser screenshot.

No product lacks suitable artwork. Microsoft/publisher images are used where a Steam capsule identified the wrong mode or season; one legacy Minecraft cover and exact-value Nintendo gift cards use the attributed retailers documented in the source table. Some official Nintendo source art is smaller than the output; it is contained/upscaled for consistent display rather than invented. Artwork rights remain with their owners; attribution is not a commercial redistribution licence. No new public deployment, Safari/Firefox run or physical-device test is claimed for this update. The available original conversation prose is exported verbatim using the existing source-log exporter; tool transport and internal instructions are not conversation entries.
