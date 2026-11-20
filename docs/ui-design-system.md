# UI design system and reference comparison

Inspected November 19, 2026 using Chromium, with 1440 × 1000 desktop and 390 × 844 mobile viewports at device scale 1. These are actual screenshots of [Eneba](https://www.eneba.com/), not generated reference mockups. Regional content, merchandising, consent and app prompts can change.

The later [homepage milestone](homepage-milestone.md) adds popular gift cards and public recommendations, and ranks category navigation by database sales. The screenshot script now captures the current six-section homepage; original color/layout measurements below remain the visual baseline.

## Reference evidence

| Page | Desktop 1440 | Mobile 390 |
| --- | --- | --- |
| Homepage | [Official reference](ui-reference/eneba-desktop-1440.png) / [implementation](ui-screenshots/keymarket-home-desktop-1440.png) | [Official reference](ui-reference/eneba-mobile-390.png) / [implementation](ui-screenshots/keymarket-home-mobile-390.png) |
| [Store](https://www.eneba.com/store/games) | [Official reference](ui-reference/eneba-store-desktop-1440.png) / [implementation](ui-screenshots/keymarket-store-desktop-1440.png) | [Implementation](ui-screenshots/keymarket-store-mobile-390.png); [reference request showed a security challenge](ui-reference/eneba-store-mobile-390.png) |
| [Product](https://www.eneba.com/other-minecraft-java-bedrock-edition-pc-official-website-key-global) | [Official reference](ui-reference/eneba-product-desktop-1440.png) / [implementation](ui-screenshots/keymarket-product-desktop-1440.png) | [Implementation](ui-screenshots/keymarket-product-mobile-390.png); [reference request showed a security challenge](ui-reference/eneba-product-mobile-390.png) |

Desktop/mobile homepage references and desktop store/product pages were available. Mobile store/product reference pages were blocked by the site's security verification; those screenshots document the limit and were not used to claim a visual match. No challenge was bypassed.

[Reference metadata](ui-reference/observations.json) records URLs, timestamps, typography and bounding rectangles. [Implementation measurements](ui-screenshots/observations.json) record page widths, card columns, image readiness and browser errors. [Tablet implementation](ui-screenshots/keymarket-home-tablet-768.png) was also checked at 768 × 1024. Full-page variants ending in `-full.png` are included for every local capture.

## Visual analysis and decisions

The reference uses a saturated purple canvas, darker navigation and very dark card bodies, with white headings, yellow actions and mint merchandising accents. Desktop content sits on a 1200px canvas. The header combines a colorful logo area, a large outlined search field, region/currency text and utility controls, followed by a separate navigation band. Keymarket keeps that hierarchy with its own geometric mark, demo disclosure and only implemented controls.

The homepage hero is full bleed: a large landscape promotion and adjacent previews. Product imagery uses tall covers with a thin platform ribbon, compact title and activation-region metadata, then bold prices. Rectangular cards have fine borders, restrained hover elevation and almost square corners. Categories use white outline icons and short labels.

Mobile collapses navigation/search behind labeled controls and scrolls category links horizontally. The live homepage recommended section uses compact full-width rows; Keymarket reuses the same ProductCard in that mode for best sellers. Deals and catalog products retain two-column cover grids. The store uses a desktop filter sidebar and a native modal filter drawer on smaller screens. Product details stack artwork, activation information and seller comparison on mobile.

| Measurement | Reference | Keymarket |
| --- | --- | --- |
| Page background | `rgb(70,24,172)`, #4618ac | Exact same canvas token |
| Desktop content | 1200px, x=120 at 1440px | 1200px, x=120 |
| Desktop header/navigation | Approximately 97px + 50px | 96px + 50px; additional 28px demo strip |
| Desktop search | Bordered field about 550 × 57px; input 528 × 55px at x=306/y=21 | Bordered field 550 × 56px at x=306/y=48; own brand allocation and demo-strip offset |
| Desktop primary hero | 1008 × 288px, y=147 | 1008 × 288px, y=174 |
| First desktop card row | Five 224px cards, 20px gaps, y=643 | Five 224px cards, 20px gaps, y=676 |
| Section type | 30px desktop / 20px mobile, Metropolis | 30px / 20px, self-hosted Inter |
| Mobile header | About 56px | 56px + 28px demo strip |
| Mobile recommended cards | Full-width compact rows | 350 × 145px rows; 76 × 101px artwork |
| Mobile catalog cards | Responsive cover grid | Two 169px columns, 12px gap, 20px outer gutters |
| Tablet home grid | Adapted from observed hierarchy; no official tablet capture | Three 229px columns at 768px |
| Viewport overflow | Visually inspected references | scrollWidth equals 1440, 768 and 390 respectively |

This reproduces the visual language and measured desktop geometry, not every pixel of the commercial site. Differences are deliberate: original brand/art, Inter instead of extracting a commercial font, visible demo disclosure, no official cashback claims, no unimplemented commerce controls, fewer real backend categories, and larger readable metadata/focus targets. Mobile hero is 260px high to preserve readable HTML promotion copy; its image composition differs from the live commercial banner. No numerical pixel-difference score is claimed for unlike content.

## Central Tailwind theme

Source of truth: [tokens.css](../frontend/src/styles/tokens.css). Tailwind 4 uses the Vite plugin and CSS-first `@theme static`; there is no competing JavaScript theme. Utilities and semantic styles consume the same custom properties.

| Token | Value | Role |
| --- | --- | --- |
| page | #4618ac | Main canvas |
| nav | #351184 | Navigation, footer, information panels |
| surface | #1f0a4d | Product/offer bodies and popovers |
| surface-raised / hover | #2b125f / #41216e | Platform ribbons and interaction states |
| text / muted | #fff / #d8c9ef | Main and supporting copy |
| accent / accent-hover | #fad318 / #ffe66b | Primary action and focus outline |
| mint | #63eac0 | Region, availability and value accents |
| line | #8b6cb5 | Visible borders and separators |
| danger | #ffbccb | Validation feedback |
| font-sans | Inter, Arial, Helvetica, sans-serif | Locally bundled open font |
| radius-card / control / panel | 0 / 0 / 6px | Rectangular commerce surfaces; modest drawer rounding |
| container-market | 75rem (1200px) | Shared desktop canvas |
| gutter / card-gap / section | 20px / 20px / 56px | Base rhythm |
| shadow-card / popover | Dark violet, 30px / 48px blur | Restrained hover/depth |

At widths below 768px, card gap becomes 12px, section spacing 40px, section title 20px and hero title 32px. Grid breakpoints are 768, 1024 and 1280px. Header/filter drawers take over below 1024px. The site supports a 320px minimum viewport; automated geometry checks cover the requested 390px, 768px and 1440px widths.

[layout.css](../frontend/src/styles/layout.css) owns primitives and shell; [marketplace.css](../frontend/src/styles/marketplace.css) owns merchandising/cards/footer; [catalog.css](../frontend/src/styles/catalog.css) owns filters/detail/offers; [responsive.css](../frontend/src/styles/responsive.css) owns shared media rules. `@apply` uses Tailwind for recurring flex/alignment primitives. Components select semantic classes rather than repeat long utility strings.

## Accessibility and interaction

Search has a labeled combobox, debounced/cancelable queries, listbox options, arrow selection, Enter navigation and Escape dismissal. Stale responses cannot replace the current term. Forms use real labels, fieldsets and price validation. URL changes synchronously update controlled facets; browser Back restores filter state.

Native dialogs provide focus containment and Escape handling; closed drawer content unmounts to avoid duplicated filter controls. A skip link targets the main landmark, focus outlines are visible, error/retry and result states are announced, decorative icons are hidden from assistive technology and reduced-motion preferences suppress animation.

The hero has manual labeled navigation and no automatic rotation. Cards are genuine product links. Seller information expands with native details/summary. Currency is static display text rather than an inactive selector. No login, cart, wishlist, newsletter or purchase action is presented before its real workflow exists.

Chromium keyboard/interaction tests and axe WCAG 2/2.1/2.2 A/AA scans cover home, store, about and product at desktop/mobile sizes. Automated scans do not certify full accessibility; no screen-reader session, Safari or Firefox validation was performed.
