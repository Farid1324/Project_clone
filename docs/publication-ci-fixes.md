# GitHub publication and hosted CI verification

The complete project is published on [main](https://github.com/Farid1324/Project_clone/tree/main). Both jobs in [Actions run 44714423834](https://github.com/Farid1324/Project_clone/actions/runs/44714423834) passed for application revision `749f8dc64a92084833a6778c9720eebee1f56935` on November 20, 2026. Later publication documentation, transcript updates and placeholder comments do not change the tested runtime code. [Machine-readable publication evidence](github-publication.json).

## First hosted run and fixes

The initial source push exposed two clean-run issues that the populated Windows workspace had hidden:

| Failure | Cause and fix | Verification |
| --- | --- | --- |
| Production container never reached readiness | Laravel view caching needs resources/views, but Git does not retain empty directories. A tracked placeholder now preserves that path in a fresh clone without ignoring future Blade templates. | Linux Docker build, deploy migrations/seeding, config/route/view caches and Nginx/FPM startup now pass |
| Two seller/cart browser cases expected PC requirements | The first product under newest sorting can be a console game in a fresh, faster seed. The test now asserts the appropriate requirements heading using the actual API kind rather than assuming Windows. | All eight product/cart cases pass locally; all 85 browser cases pass in hosted CI |

The runtime-directory fix is backend/resources/views/.gitignore. The platform-aware assertion is frontend/tests/product-cart.spec.ts. .gitattributes also disables line-ending conversion for the verbatim conversation file, so Git checkouts preserve its original message bodies. README/checklist/deployment/security docs and github-publication.json record the actual published state.

## What the passing run establishes

- The test job completed Composer validation/audit, PostgreSQL backend assertions, seven secret-check/exporter tests, npm audit, TypeScript, lint, frontend build and **85 passing browser tests** against compiled React and Laravel on one local HTTP origin.
- The production-image job built the root Dockerfile on Linux, started it with generated CI credentials and a disposable PostgreSQL database, then checked readiness, SPA deep links, catalog JSON, missing static-file errors and guest checkout protection.
- The PHP command exited successfully with **1,320 assertions**, but its compact hosted summary labeled the 111 tests as warnings. No warning details were printed by that compact command. This is recorded as a warning-bearing backend result, not described as a warning-free run. The local backend verification remains a separate result.
- Neither job provisions Render/Neon or verifies a public application origin. Public HTTPS authentication, real hosting limits and the deployment URL remain deployment tasks. The existing local Nginx HTTPS audit is also separate from the CI HTTP browser run.

## Reproduce

Use [README test commands](../README.md#tests) for local PHP/browser checks and the [deployment guide](deployment.md) for building the root Dockerfile on a Docker-capable host. Push runtime changes to run the published workflow. Documentation-only publication/transcript commits may skip duplicate CI; the exact tested application revision is retained above.

Before any push, run `node scripts/check-submission-secrets.mjs`. Credentials, private keys, tool runtimes, dependencies, database state, caches, browser traces and generated builds remain excluded from Git. The published tree was checked to contain none of the prohibited local paths. The full original available user/assistant prose is exported from the private local session; only that prose and its integrity metadata are published.
