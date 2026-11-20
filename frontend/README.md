# Keymarket frontend

The [assignment audit](../docs/assignment-audit.md) verifies the compiled app over a single HTTPS origin. For a native compiled preview, run `scripts/build-single-origin.ps1` from the repository root and serve Laravel on port 8000. The Vite workflow below remains available for hot reload. [Production deployment](../docs/deployment.md) uses Nginx/PHP-FPM and the root Dockerfile; no public URL has been verified.

React 19 + TypeScript + Vite 8 + Tailwind 4. This independent internship demo uses the Laravel catalog API in `../backend`.

From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Laravel must run at `http://127.0.0.1:8000`. Vite serves `http://127.0.0.1:5173` and proxies `/api`, `/sanctum` and `/demo`. Optional target override: copy `.env.example` to `.env.local`. Keep API and image requests on the same origin. The local proxy serializes upstream connections for Windows PHP's single-threaded server.

```powershell
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run capture:local
# External live reference; region, merchandising and security challenges may vary.
npm.cmd run capture:reference
```

Playwright starts/reuses Vite, checks Laravel readiness and uses real seeded API data, except explicit failure/empty/loading simulations. Do not run it against production. Backend/database setup: [root README](../README.md). Current catalog/search behavior and validation: [catalog milestone](../docs/catalog-milestone.md). Homepage data-flow mapping: [homepage milestone](../docs/homepage-milestone.md). Original visual design: [UI milestone](../docs/ui-milestone.md). On the portable Windows PHP runtime, use the opcode-cached browser-test server command in the homepage guide for the expanded test suite.

Current authenticated purchasing behavior, setup, changed files and verification are documented in the [purchasing milestone](../docs/purchasing-milestone.md). Product details use database metadata and independent seller offers. The shared cart persists through Laravel sessions; writes carry offer IDs and CSRF tokens and never client prices. Checkout uses server quotes, explicit simulation controls, and stable retry IDs. Order keys are private, fetched only from an authenticated owner-scoped endpoint, and never persisted to browser storage. Browser purchasing tests create demo users/orders and consume nonredeemable stock; use only a local seeded environment.

Structure: `src/components` reusable UI; `src/pages` route composition; `src/hooks` queries/page titles; `src/lib` fetch/money/URL helpers; `src/types` API contracts; `src/styles` centralized Tailwind theme plus semantic component styles. No product content is embedded in React.

Build output is `dist/`. `npm run preview` serves the build at port 4173 with the same local proxy. Production hosting must serve the SPA with history fallback and reverse proxy `/api`, `/sanctum` and `/demo` to Laravel; Vite's proxy is development/preview configuration, not a production web server.
