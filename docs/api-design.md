# Implemented REST API

Current milestone: Laravel catalog/homepage API, session-owned seller-offer cart, Sanctum cookie authentication, simulated checkout and private order/key history at `/api/v1`. No real payment provider or bearer-token issuance is exposed.

## Endpoints

| Method and path | Query / behavior |
| --- | --- |
| GET /up | Laravel process liveness |
| GET /api/v1/health | PostgreSQL readiness, 200 ready / 503 unavailable |
| GET /api/v1/products | Search, facets, price range, stock, promotion, sorting, pagination |
| GET /api/v1/products/{slug} | Published product, activation information, independent visible offers |
| GET /api/v1/categories | Paginated categories with published-product counts |
| GET /api/v1/categories/{slug} | One category and published-product count |
| GET /api/v1/catalog/filters | All backend-managed categories, platforms, regions |
| GET /api/v1/offers | Paginated visible offers; product_id, seller_id, in_stock filters |
| GET /api/v1/offers/{uuid} | Offer price, seller rating/count, stock count, active promotions |
| GET /api/v1/search/suggestions | Same catalog search, q length 2–100, limit 1–8 |
| GET /api/v1/home/banners | BannerService, current schedule/visibility, ordered, max 8 |
| GET /api/v1/home/categories | PopularCategoryService, recent sales of stocked published products, max 9; products_count counts available products |
| GET /api/v1/home/best-sellers | BestSellerService, games only, fulfilled quantities over 30 days, current stock, max 12 |
| GET /api/v1/home/deals | DealService, stocked discounted offers in active campaigns, max 12 |
| GET /api/v1/home/gift-cards | GiftCardService, stocked gift cards ranked by recent fulfilled quantity, then price/ID, max 12 |
| GET /api/v1/home/recommendations | RecommendationService, available-seller rating/depth, release date and creation date, then ID, max 12 |
| GET /api/v1/home/promotions | PromotionsQuery, current campaigns with available offers, paginated |
| GET /api/v1/cart | Current session-owned cart; empty response does not create a cart database row |
| POST /api/v1/cart/items | Add selected offer_id UUID; optional quantity 1–9, defaults to 1 |
| PATCH /api/v1/cart/items/{item} | Set quantity 1–9 on an owned cart-item UUID |
| DELETE /api/v1/cart/items/{item} | Remove owned cart-item UUID, including unavailable lines |
| GET /api/v1/auth/session | Current user {id,name,email} or null; initializes/reads the browser session |
| POST /api/v1/auth/register | name, email, password, password_confirmation; 201 session/user, guest cart merged |
| POST /api/v1/auth/login | email, password; 200 session/user, guest cart merged |
| POST /api/v1/auth/logout | Requires auth:sanctum; invalidates session and rotates CSRF token |
| GET /api/v1/checkout/quote | Requires auth:sanctum; current cart and encrypted ten-minute quote |
| POST /api/v1/checkout | Requires auth:sanctum; quote_token, idempotency_key UUID, scenario approve/decline |
| GET /api/v1/orders | Requires auth:sanctum; owner-only history, page/per_page (1–24, default 12) |
| GET /api/v1/orders/{uuid} | Requires auth:sanctum; owner-only order snapshots and fulfilled demo keys |

The six displayed homepage sections each have their own service and endpoint. The legacy promotions endpoint remains available for collection clients but is no longer a displayed homepage section. Each endpoint executes its own query; none delegates to a static frontend product array or substitute section. Banners targeting unpublished products are excluded. Time windows include their start and exclude their end. Best sellers require current stock and count only fulfilled orders within the UTC time window. Deals choose one winning offer per product using a SQL window function; its price/comparison/discount are kept together.

Homepage lists return the normal { data: [...] } envelope, including empty arrays. Limits are fixed and no client limit/seed selection is required. Catalog popularity, best sellers, categories and gift cards share `App\Queries\Catalog\RecentSalesQuery` for the same inclusive 30-day fulfilled-order window, excluding future orders. Category ties use available product count, name and ID. Recommendation ties use product ID; release-date nulls sort last. Recommendations are public discovery picks, not personalized and not a product review score. No endpoint calls another section endpoint. See [homepage milestone](homepage-milestone.md) for independent React Query wiring and ranking trade-offs.

All catalog routes are throttled to 120 requests/minute/IP; suggestions use 60/minute/IP. Health is unthrottled. UUID offer routes reject malformed IDs before PostgreSQL receives them. Unknown/inactive products, hidden offers, and missing resources return 404.

## Product query

Example in PowerShell:

```powershell
Invoke-RestMethod 'http://localhost:8000/api/v1/products?q=eldn%20ring&platforms[]=steam&regions[]=GLOBAL&sort=price_asc&per_page=12'
```

| Parameter | Validation / semantics |
| --- | --- |
| q | Optional trimmed string, max 100; empty means browse |
| categories[] | Existing category slugs, distinct, max 20 |
| platforms[] | Existing platform slugs, distinct, max 20 |
| regions[] | Existing region codes, distinct, max 20 |
| type | game or gift_card |
| price_min / price_max | Nonnegative integer EUR cents, up to PostgreSQL integer maximum; min <= max |
| promotion | Existing campaign slug; only active qualifying offers match |
| in_stock | Defaults true; accepts true/false or 1/0 |
| sort | relevance, price_asc, price_desc, title_asc, newest, popularity |
| page | Positive integer, max 100000 |
| per_page | 1–48, default 24; promotions default 12 |

Multiple values in one facet use OR; facets combine with AND. Price bounds must match one stocked eligible offer, and the displayed price is the minimum among matching offers. An unavailable cheap seller cannot determine the displayed price. Pagination happens at product level, so seller joins do not duplicate products.

With in_stock=false, published sold-out products may appear with null prices and false availability. A price range or promotion filter still requires an eligible matching offer. Price sorts put nulls last. Popularity orders the sum of fulfilled order-item quantities over the last 30 days across seller offers; failed, older and future orders do not count. Unsold eligible products have zero sales and remain visible. Popularity ties use catalog creation time descending, then product ID. Default sort is relevance for search, otherwise newest by catalog creation time; every sort has a stable product-ID tie-break. Relevance without a search falls back to newest.

Partial/typo search uses indexed lower-case title predicates, literal LIKE escaping, and PostgreSQL trigram/word similarity. Exact/prefix/substring matches rank above fuzzy candidates. Whole-title and word similarity use 0.3 and 0.4 thresholds through SET LOCAL in a short search transaction. Prior connection values are restored on success, including nested transactions; rollback handles failed queries. One/two-character store searches use prefix matching. Suggestions require two characters and return at most eight available products. Both endpoints use ProductQuery and exactly the same relevance ordering. Typo tolerance is bounded by similarity; it does not promise arbitrary correction. [pg_trgm documentation](https://www.postgresql.org/docs/18/pgtrgm.html).

Unsupported query fields, invalid facet values, oversized pages, invalid sorts, and malformed search values return 422. A valid page beyond the last page returns an empty data array with unchanged total; the store offers a first-page recovery action that preserves filters. Category/promotion lists accept page/per_page. Offer lists additionally accept product_id, seller_id, and in_stock; offer detail can report a visible sold-out offer.

## Response resources

Resources use UUID strings, integer EUR minor units, and backend-generated image URLs. Single resources and collections use a data envelope. Paginated collections include Laravel links and meta, including current_page, per_page, last_page, and total.

Product cards expose ID/slug/title/type, cover_image_url, platform, region, categories, current/comparison prices, discount_percent, currency, available_offer_count, and is_available. The offer count reflects the current query's qualifying offers. Details add description, edition, publisher/release date when available, activation instructions/notice, compatibility_notice, delivery_information, requirements, and independent seller offers including sold-out visible offers. Offers sort by ascending price with a stable ID tie-break; a cheaper sold-out offer stays in that order but cannot set the available-from price or receive a lowest-available badge. Unpublished products return 404; published products without available offers remain readable with is_available=false and price_minor=null.

Requirements are nullable structured data: kind=pc or activation, minimum/recommended arrays of label/value pairs, notes, optional source_url/captured_at, and activation_steps. Minimum/recommended PC values are captured publisher Windows specifications; console/gift-card values describe device/account compatibility. Activation instructions use product-specific steps when supplied, otherwise platform instructions. Product metadata is serialized only for detail responses, not card lists. See [data provenance](product-data-provenance.md).

Each offer exposes its own ID/product ID/price/comparison/currency, exact stock_available, availability, seller ID/name/rating/rating_count, and active campaign summaries. Ratings belong to sellers; they are not copied into every offer. Public responses never serialize inventory keys, ciphertext, or fingerprints.

Promotions expose copy/image/schedule and available-offer count. Banners expose copy/image/alt text and an internal destination type plus optional product slug. Backend-owned data supports React without hardcoded marketplace content.

## Error envelope

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request contains invalid fields.",
    "request_id": "<uuid>",
    "fields": { "per_page": ["The per page field must not be greater than 48."] }
  }
}
```

Responses include an X-Request-ID header. Error codes include validation_failed (422), not_found (404), method_not_allowed (405), conflict (409), csrf_mismatch (419), rate_limited (429), and internal_error (500). Cart conflicts include a safe actionable explanation of stock, availability or quantity/line limits. Rate-limit headers are retained. Error resources omit SQL, secrets, and traces even when the server logs diagnostic exceptions. PostgreSQL readiness uses a separate generic status response with 503 on failure.

## Cart ownership and write contract

The browser sends only `{ "offer_id": "<uuid>", "quantity": 1 }` to add a line. It never supplies prices, product IDs, seller IDs, cart IDs or owner IDs; unsupported fields return 422. An existing line for the same offer increments its quantity. Another seller's offer for the same product creates a distinct line. PATCH accepts only quantity. Foreign cart-item IDs return 404, preventing owner enumeration.

Cart responses use `{data: {...}}`: id (null when absent), version, currency, items, items_count (sum of quantities), total_minor, has_unavailable_items, and limits (quantity_per_offer=9, distinct_offers=20). Each line includes its own id/offer_id/quantity, product identity/platform/region/artwork, seller identity/rating/count, current unit_price_minor, line_total_minor, stock_available and is_available. Reads re-quote current prices and retain unavailable items for removal. There is no price guarantee, reservation, payment or key allocation.

The cart ID is held in the server-side guest session. If authenticated, the service resolves the user's cart instead and ignores guest ownership. Registration/login claim a guest cart or merge it into the saved account cart. Same-offer quantities combine up to nine; saved lines have priority at the twenty-offer limit. Any capped/omitted guest quantities are explicitly reported through cart_merge_notices. Unavailable lines are retained for review. Logout keeps the account cart in the database, inaccessible from the new guest session. Writes lock the cart and chosen offer in a database transaction and recheck stock and active product/offer/seller. A failed write rolls back its changes; a new guest cart is remembered only after successful commit. Effective writes increment version. Checkout quotes bind that version; ordinary cart PATCH still sets an absolute quantity without optimistic version preconditions.

Authentication responses are `{data: {user: {id,name,email} | null, cart_merge_notices: string[]}}`. Email is trimmed/lowercased and uniquely indexed without case sensitivity. Registration requires matching passwords of at least twelve characters; registration/login passwords must be at most 72 UTF-8 bytes without null characters; the User hashed cast stores bcrypt hashes. Invalid login responses do not distinguish unknown emails from wrong passwords and validation is timeboxed. Sessions rotate on registration/login; logout destroys the previous session and rotates CSRF. Protected endpoints use auth:sanctum over the web session. Bearer token retrieval is explicitly disabled for this SPA. Passwords, session identifiers and inventory internals are never resource fields. Auth is throttled to twenty requests/minute/IP and five/minute/email+IP; checkout/history to sixty/minute/user. Sensitive responses and API errors have Cache-Control: no-store, private. Unauthenticated API requests return JSON 401 even without Accept: application/json.

Cart routes explicitly use Laravel web/session/request-forgery middleware and session blocking, with a 90 requests/minute/IP throttle. Catalog/home/search/health reads omit Sanctum's stateful middleware, remain stateless, and do not create competing session cookies during parallel initial page loads. The cart GET establishes the single browser session. These are same-origin SPA endpoints; serve frontend/API behind one origin in production.

The mutation client initializes `/sanctum/csrf-cookie` when needed, sends the decoded XSRF-TOKEN cookie as X-XSRF-TOKEN, and retries once only after a 419 rejection. It does not retry ambiguous POST failures. Laravel 13's default forgery middleware accepts a valid same-origin Sec-Fetch-Site signal or a valid CSRF token; cross-site requests without a matching token fail 419. See [Laravel CSRF](https://laravel.com/framework/docs/13.x/csrf), [Sanctum SPA cookies](https://laravel.com/framework/docs/13.x/sanctum), and [session blocking](https://laravel.com/framework/docs/13.x/session#session-blocking). Real HTTP tests exercise cross-site rejection, token-bearing success and independent-session isolation; PHPUnit middleware bypass is not treated as proof of CSRF enforcement.

## Checkout and private delivery

GET checkout/quote returns `{data: {cart, quote_token, checked_at, expires_at}}`. It does not reserve inventory. The authenticated-encrypted quote binds owner, cart ID/version, offer/quantity/price/stock and product/platform/region IDs. POST accepts only `{quote_token, idempotency_key, scenario}`; prices, owner IDs, card fields or real-provider choices return 422. An empty/unavailable/changed/expired/foreign/tampered quote returns 409 before any order or payment commits. Even a stock change that leaves enough keys requires fresh review. See [checkout transaction and concurrency rationale](purchasing-milestone.md).

A new approved simulation commits a fulfilled order, immutable item snapshots, approved simulated payment, exact key allocations and cart clearing in one transaction. A declined simulation commits payment_failed order/item snapshots and a declined simulated payment while retaining the cart and all keys. Both are terminal demo outcomes, with 201 for a new order and 200 for an identical replay. The unique (user_id,idempotency_key) and stored request hash bind the exact quote token/scenario. Reusing that ID with a different body is a 409. Replaying the original body returns the same order before checking current cart or quote expiration.

Order resources expose ID/status/currency/total/timestamps, simulated payment provider/status/reference, and item snapshots of product/seller/platform/region/unit price/quantity/line total. Only the owner-scoped order-detail route eager-loads and decrypts fulfilled item keys into `items[].keys`; checkout responses and history lists omit keys. Foreign IDs and missing IDs both return 404. Failed orders never expose keys. History uses stable created_at/ID descending pagination. These keys are nonredeemable demo strings, not real entitlements. Credentials and plaintext keys must not enter logs or browser persistence. The UI stores only a pending encrypted quote/request ID/outcome in per-tab sessionStorage to recover ambiguous responses; its keys are scoped to the signed-in account.
