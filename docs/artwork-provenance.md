# Artwork and font provenance

Keymarket is an independent internship demo. Names of games and platforms identify illustrative catalog listings. No official product-cover raster, Eneba logo, commercial screenshot or downloaded promotional banner is used as application artwork.

## Application assets

- `backend/public/demo/*-steam-*.svg`, console-title and wallet SVGs: original symbolic geometry and product-name text authored for the preceding backend milestone. They are explicitly labeled original demo artwork, not official covers. 44 catalog title cards plus the generic fallback remain. The later catalog milestone adds a US regional listing that reuses the original Global listing’s artwork through backend artwork_slug seed metadata; 45 listings therefore share 44 title cards.
- `backend/public/demo/banner-discover-v2.png`: original fantasy illustration generated with the built-in image-generation tool for this milestone. Source output: `C:/Users/ferid/.codex/generated_images/01a1f4cc-3978-7db3-9808-a3bc55e4af26/exec-0af81e28-bb97-4011-950f-2e3693efadba.png`. Repository copy is the portable application asset; no remote image service is required.
- `backend/public/demo/banner-deals-v2.svg`, `banner-gift-cards-v2.svg`: original code-native geometric illustrations adapted from our earlier original banner SVGs. Embedded promotional text was removed so responsive HTML owns the accessible title and CTA.
- `frontend/public/keymarket.svg` and `src/components/Brand.tsx`: original three-piece geometric mark and Keymarket wordmark. No Eneba logo reuse.
- `backend/public/demo/cover-unavailable.svg`: original code-native fallback illustration, used only if an API image URL is empty or fails to load. None of the 45 seeded product listings uses this fallback as its assigned cover.
- Lucide React icons: bundled package, ISC license; see `frontend/node_modules/lucide-react/LICENSE` after installation.
- Inter: self-hosted through `@fontsource/inter`, SIL Open Font License; license is included in the installed package. We did not copy the reference site's Metropolis files.

The seeder provides asset paths and alt text through the banner/product API. UI image elements read those responses. No product artwork URLs are embedded in React.

The cover follow-up checks all 45 listings (37 games and eight gift cards), their 44 distinct covers, three banners and two promotion records. There are 47 distinct referenced image URLs because promotion images reuse banner artwork. Every catalog and detail cover is decoded in a real browser. MarketplaceImage provides the same failure handling in cards, detail pages, search suggestions, carts and the hero; changing to a valid API URL restores the original image. See [artwork milestone](artwork-milestone.md) for commands and current evidence.

## Exact image-generation prompt

Generated through the built-in image-generation tool, opaque background, with no reference image input:

> Use case: ads-marketing. Asset: a wide landscape promotional background for an independent digital game marketplace internship demo. Create original cinematic fantasy key art: a tiny cloaked traveler on a rocky ridge looking toward an immense ruined citadel and distant mountains beneath a luminous lavender sky, with subtle gold light and drifting mist. Rich deep violet shadows, magenta accents, amber highlights; visually detailed, premium game-poster illustration. Composition: the atmospheric landscape and citadel occupy the right two thirds; the left third stays very dark violet with gentle atmosphere and clean negative space for HTML promotion text. Wide landscape around 2.5:1. No text, no logos, no UI, no real game characters, no franchise symbols, no recognizable copyrighted artwork, no watermark. This is fictional illustrative demo artwork, not an official game cover.

The generated scene was visually inspected before use. HTML overlays the API-managed promotion title, subtitle and navigation; text is not baked into the illustration. The UI labels the illustration and the entire service as demo content. AI-generated originality does not constitute an independent legal clearance opinion.

## Reference-only screenshots

`docs/ui-reference/eneba*.png` are real Chromium screenshots from the official website on November 19, 2026, retained solely as study/review evidence. They contain third-party commercial marks/artwork and are not application assets. Do not redistribute them as Keymarket marketing or deploy the documentation screenshot directory as a public artwork library. Two mobile route captures contain the site's security challenge instead of product/store UI; this limit is recorded in [the comparison](ui-design-system.md).

`docs/ui-screenshots/keymarket*.png` are captures of our implemented interface, using the original assets above. [Reference metadata](ui-reference/observations.json) and [local measurements](ui-screenshots/observations.json) describe capture sizes and outcomes.
