# Assignment integration audit

The later submission pass adds a [requirement-by-requirement checklist](submission-checklist.md), [interview walkthrough](architecture-explained.md) and [fresh verification](submission-verification.json). This report retains the earlier compiled HTTPS audit evidence.

Audited November 20, 2026 against the Eneba Intern Assignment requirements supplied in this conversation. This report describes the implemented marketplace and executed checks; it does not certify an unseen external rubric.

## Outcome and scope

The complete requested purchase journey works locally with compiled React, Laravel production settings and PostgreSQL through **one HTTPS Nginx origin**. Deployment configuration is prepared for Render Free + Neon Free. **Public deployment remains unperformed: no verified public URL exists.** Docker and hosted CI were not available for execution here.

The final machine-readable results are in [audit-verification.json](audit-verification.json). Earlier milestones retain their historical test counts; this audit is the current integration report.

## Requirement and journey matrix

| Requirement / journey | Implementation and evidence |
| --- | --- |
| React/TypeScript/Vite, Tailwind, Laravel REST, PostgreSQL, Sanctum | Locked dependencies inspected; explicit TypeScript/build/lint checks and PostgreSQL PHPUnit suite executed |
| 1. Register, log in and log out | AuthenticationTest plus purchasing browser flows and the combined assignment journey; hashing, validation, generic failed login, rotation/revocation and CSRF covered |
| 2. Homepage and store | Six independent homepage endpoints/services and real catalog queries; homepage section isolation and data mapping tests; all route widths audited |
| 3. Complete/partial/typo search | Exact Elden Ring, elden, ELDEN, eldn ring and minecraf database searches; existing debounced global keyboard search tests across routes |
| 4. Combined filters and sorting | Category/platform/region/price/stock query tests, price/popularity/newest ordering, pagination, URL reload/Back; combined assignment journey matches actual API IDs |
| 5. Compare multiple sellers | Product-to-offer/seller relationships, price order, ratings/stock and independent available-from price; actual seeded offers rendered |
| 6. Add a specific offer | Browser checks selected offer UUID and seller price, distinct sellers/quantities, persistence and removal; backend rejects client-price tampering |
| 7. Guest checkout | Client sign-in gate and real server JSON 401; a guest cannot submit checkout or access history |
| 8. Authenticated simulated payment | Guest cart merge, reviewed quote, successful/declined outcomes, changed price/stock/compatibility/expiry, forged quotes and interrupted-response recovery |
| 9. Unique key delivery | Exact quantity of unique nonredeemable keys, encrypted inventory, transactional allocation, rollback and concurrent last-key competition |
| 10. Previous orders and keys | Owner-scoped detail/history; logout/login retrieval, foreign-order denial, pagination and out-of-range first-page recovery |
| Responsive/accessibility/error states | 320/390/768/1440 route checks, fourteen configured axe scans, loading/empty/error/conflict/sold-out tests |
| Images, navigation and console/network | All seeded cover/banner/promotion URLs checked for same origin, image MIME and nonzero bytes; forty route/viewport combinations have no unexpected console/HTTP errors or overflow |
| Production deployment preparation | Single-origin compiled SPA routing, Nginx/PHP-FPM image, trusted proxies, TLS database example, persistent sessions/cache, guarded startup migration/seed, official Render schema validation |

The seven new assignment-audit browser tests add a complete account-to-key-history journey, exact/partial/typo API checks, all seeded media checks, and ten routes at each of four widths. The combined journey also verifies two distinct keys and recovery from an empty out-of-range history page. Existing tests cover the rest of the detailed behaviors; no React product array is used as the data source.

## Fixes made during this audit

- Added the missing production delivery path: root multi-stage Docker image, compiled React in Laravel's public directory, Nginx front-controller/static routing, PHP-FPM and process supervision. The older backend Dockerfile/Compose remain explicitly development tools.
- Added a SPA fallback for root/deep links while excluding API, Sanctum, health and asset namespaces. Missing assets/API endpoints retain real error responses instead of returning index HTML.
- Added configuration-backed trusted-proxy handling for correct HTTPS asset origins and cookies, including tests that untrusted forwarded headers are ignored.
- Added guarded serialized deployment migrations and explicit first-boot demo seeding. The original blanket production seed prohibition otherwise prevented a hosted assignment demo from receiving data. Opt-in remains required, secrets are validated, and restarts preserve nonempty catalog/inventory state.
- Added verified hashed-asset caching and production CSP/security headers; corrected Nginx location precedence so the asset cache policy actually applies. SPA HTML remains private and requires revalidation.
- Fixed order-history navigation: an out-of-range empty page now offers a working First page link, exercised by the integrated journey.
- Removed hardcoded localhost ports from isolated browser-session tests and added external-server/self-signed-local-QA options, allowing the suite to target the actual compiled HTTPS deployment path.
- Expanded CI with frontend checks, compiled single-origin browser regression, and a production image startup smoke job; preserved LF endings for production shell/config files.

Initial image-audit failures were test synchronization errors: scrolling occurred before all independent homepage sections finished loading. Waiting for the sections before lazy-image checks resolved them; the media URLs themselves were valid. The audit did not invent missing artwork or change styling without an observed issue.

The final credential review also reproduced and fixed two malformed-input HTTP 500s: an array email in rate limiting and a null-byte bcrypt registration password. Email rate-limit normalization now checks input types; shared login/registration password bounds reject null characters and more than 72 UTF-8 bytes. Unit and real HTTPS HTTP regressions verify 422 responses without creating accounts.

## Executed environment and verification limits

Initial local checks passed all 102 pre-audit backend tests, TypeScript, lint/build and production dependency advisory scans. Eight new operational tests initially brought the backend to **110 passing tests / 1,301 assertions**, including actual independent-process PostgreSQL contention tests. After the credential-validation regression, the final backend suite passes **111 tests / 1,318 assertions**. All seven migrations are applied; migrate reported nothing pending. The Render blueprint passed the official https://render.com/schema/render.yaml.json schema. Shell and Nginx syntax checks passed. Production config/route/view cache commands also passed using isolated ignored cache files; default application configuration caching was left unchanged. Automatic review rejected the original combined validation/cleanup command with only “blocked by policy”; validation then succeeded without deletion.

The final compiled HTTPS browser run passed **78 tests**, with zero failed, skipped or flaky tests, including fourteen configured axe scans. Lint, explicit TypeScript checking and the production build passed. npm and Composer reported no known production-dependency advisories in their executed scans. [Mobile homepage capture](ui-screenshots/keymarket-audit-home-390-full.png), [desktop store capture](ui-screenshots/keymarket-audit-store-1440-full.png).

Browser QA uses the compiled build behind Nginx 1.30.7 on https://localhost:8443 and PHP 8.4 CGI with APP_ENV=production. The production Nginx template is reused with local paths/log files, a loopback TLS listener and a short-lived self-signed certificate. HTTPS verification is bypassed only in that local Playwright run; no system CA was installed and no public TLS verification was disabled. Production Secure cookie flags, CSP, same-origin media, actual API calls and deep links are exercised. This is not a public deployment and does not validate Render's infrastructure.

QA-only process settings CACHE_STORE=array and BCRYPT_ROUNDS=4 avoid cumulative rate-limit counters and slow fixture hashing. Normal deployment uses PostgreSQL-backed sessions/cache and its normal password cost. Browser tests consume demo stock/create demo accounts/orders. Backend tests use only marketplace_testing; development/browser data lives in marketplace. Run one backend suite at a time against the isolated test database.

Docker/Linux PHP-FPM/supervisor runtime and hosted CI were **not executed**. Local PHP-CGI/Nginx testing, Laravel operational tests and schema/shell validation give concrete coverage without claiming a container build or public deployment. Hosted database TLS configuration is prepared, not a verified Neon account connection. The provided public verifier was syntax/help checked, but not run against a public URL because none is configured.

Expected failures are deliberately tested: unauthenticated/foreign resource, CSRF, validation, conflict, throttle, failed payment and forced rollback responses. These are distinct from unexpected console/HTTP failures in normal successful journeys. Accessibility results describe the scanned states/rules, not a complete accessibility certification.

## Reproduce checks

From the repository root on the portable Windows runtime:

```powershell
.\scripts\local-database.ps1 start
npm.cmd run lint --prefix frontend
npm.cmd run typecheck --prefix frontend
.\scripts\build-single-origin.ps1
Set-Location backend
& ..\.tools\php\php.exe artisan migrate --no-interaction
& ..\.tools\php\php.exe artisan test --compact
& ..\.tools\php\php.exe vendor/bin/pint --dirty --format agent
& ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

In another terminal:

```powershell
Set-Location frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8000'
npm.cmd run test:e2e
```

The recorded stricter local HTTPS run additionally used PLAYWRIGHT_BASE_URL=https://localhost:8443 and PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1 behind the temporary QA Nginx/certificate. This certificate bypass is for self-signed loopback QA only. The native preview on port 8000 requires no TLS override. Production image/host commands and public verification steps are in [deployment.md](deployment.md).

## Changed files and remaining work

The complete A/M/D list is [audit-changed-files.json](audit-changed-files.json), compared with hashes saved immediately before this task because this repository has no initial commit. It excludes local runtimes, generated builds, test traces, secrets and certificates.

| Area | Changes |
| --- | --- |
| Runtime/deployment | Root Dockerfile/dockerignore, Render blueprint, production environment example, Nginx/FPM/PHP/supervisor/entrypoint, deploy command and proxy/TLS config |
| App integration | SPA controller/routes, guarded seeder, history recovery link, compiled-asset copy helper and ignore/line-ending rules |
| Tests/tooling | DeploymentTest, root test adjustment, assignment-audit.spec.ts, configurable browser origins, public read-only verifier and expanded workflow |
| Documentation | README, deployment guide, this audit, verification/manifest and available verbatim chat history |

To finish public release, connect your Git repository and hosting accounts, configure stable secrets/direct TLS PostgreSQL, deploy, verify the actual public URL and repeat authenticated browser journeys there. Only then fill README's live URL. Real payments/keys, refunds, seller administration, account recovery/email verification and production SLAs remain outside the internship demo.
