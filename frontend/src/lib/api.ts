import type { Banner, Cart, CatalogFilters, Category, CheckoutQuote, Envelope, Order, Paginated, Product, Promotion, PurchaseRequest, Session, WishlistSummary } from '../types/api'

export class ApiError extends Error {
  status: number
  fields?: Record<string, string[]>
  constructor(message: string, status: number, fields?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/v1' + path, { signal, headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(body?.error?.message ?? 'The marketplace could not be reached. Please try again.', response.status)
  if (!body || !('data' in body)) throw new ApiError('The marketplace returned an unexpected response.', 502)
  return body as T
}

let csrfRequest: Promise<void> | null = null
const csrfToken = () => document.cookie.split('; ').find(cookie => cookie.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length)

async function initializeCsrf(force = false): Promise<void> {
  if (!force && csrfToken()) return
  csrfRequest ??= fetch('/sanctum/csrf-cookie', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(response => { if (!response.ok) throw new ApiError('The cart session could not be initialized. Please retry.', response.status) })
    .finally(() => { csrfRequest = null })
  await csrfRequest
}

async function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: object, signal?: AbortSignal): Promise<T> {
  await initializeCsrf()
  signal?.throwIfAborted()
  const send = () => fetch('/api/v1' + path, {
    method, signal, credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(csrfToken() ?? '') },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  let response = await send()
  // A CSRF rejection happens before the mutation; refreshing this token is safe.
  if (response.status === 419) {
    await initializeCsrf(true)
    signal?.throwIfAborted()
    response = await send()
  }
  const body = await response.json().catch(() => null)
  signal?.throwIfAborted()
  if (!response.ok) throw new ApiError(body?.error?.message ?? 'The request could not be completed. Please retry.', response.status, body?.error?.fields)
  if (!body || !('data' in body)) throw new ApiError('The cart returned an unexpected response.', 502)
  return body as T
}

const wishlistWrites = new Set<AbortController>()
export function cancelWishlistWrites() {
  for (const controller of wishlistWrites) controller.abort()
}

async function wishlistWrite(path: string, method: 'POST' | 'DELETE', payload?: object): Promise<Envelope<WishlistSummary>> {
  const controller = new AbortController()
  wishlistWrites.add(controller)
  try { return await write<Envelope<WishlistSummary>>(path, method, payload, controller.signal) }
  finally { wishlistWrites.delete(controller) }
}

export const api = {
  session: (signal?: AbortSignal) => get<Envelope<Session>>('/auth/session', signal),
  login: (data: { email: string; password: string }) => write<Envelope<Session>>('/auth/login', 'POST', data),
  register: (data: { name: string; email: string; password: string; password_confirmation: string }) => write<Envelope<Session>>('/auth/register', 'POST', data),
  logout: () => write<Envelope<Session>>('/auth/logout', 'POST'),
  wishlistSummary: (signal?: AbortSignal) => get<Envelope<WishlistSummary>>('/wishlist/summary', signal),
  wishlist: (page: number, signal?: AbortSignal) => get<Paginated<Product>>('/wishlist?' + new URLSearchParams({ page: String(page), per_page: '24' }), signal),
  saveWishlistProduct: (productId: string) => wishlistWrite('/wishlist', 'POST', { product_id: productId }),
  removeWishlistProduct: (productId: string) => wishlistWrite('/wishlist/' + encodeURIComponent(productId), 'DELETE'),
  quote: (signal?: AbortSignal) => get<Envelope<CheckoutQuote>>('/checkout/quote', signal),
  purchase: (data: PurchaseRequest) => write<Envelope<Order>>('/checkout', 'POST', data),
  orders: (page: number, signal?: AbortSignal) => get<Paginated<Order>>('/orders?' + new URLSearchParams({ page: String(page), per_page: '12' }), signal),
  order: (id: string, signal?: AbortSignal) => get<Envelope<Order>>('/orders/' + encodeURIComponent(id), signal),
  cart: (signal?: AbortSignal) => get<Envelope<Cart>>('/cart', signal),
  addCartItem: (offerId: string) => write<Envelope<Cart>>('/cart/items', 'POST', { offer_id: offerId, quantity: 1 }),
  updateCartItem: (id: string, quantity: number) => write<Envelope<Cart>>('/cart/items/' + encodeURIComponent(id), 'PATCH', { quantity }),
  removeCartItem: (id: string) => write<Envelope<Cart>>('/cart/items/' + encodeURIComponent(id), 'DELETE'),
  banners: (signal?: AbortSignal) => get<Envelope<Banner[]>>('/home/banners', signal),
  popularCategories: (signal?: AbortSignal) => get<Envelope<Category[]>>('/home/categories', signal),
  bestSellers: (signal?: AbortSignal) => get<Envelope<Product[]>>('/home/best-sellers', signal),
  deals: (signal?: AbortSignal) => get<Envelope<Product[]>>('/home/deals', signal),
  giftCards: (signal?: AbortSignal) => get<Envelope<Product[]>>('/home/gift-cards', signal),
  recommendations: (signal?: AbortSignal) => get<Envelope<Product[]>>('/home/recommendations', signal),
  promotions: (signal?: AbortSignal) => get<Paginated<Promotion>>('/home/promotions', signal),
  filters: (signal?: AbortSignal) => get<Envelope<CatalogFilters>>('/catalog/filters', signal),
  products: (query: string, signal?: AbortSignal) => get<Paginated<Product>>('/products' + (query ? '?' + query : ''), signal),
  product: (slug: string, signal?: AbortSignal) => get<Envelope<Product>>('/products/' + encodeURIComponent(slug), signal),
  suggestions: (term: string, signal?: AbortSignal) => get<Envelope<Product[]>>('/search/suggestions?' + new URLSearchParams({ q: term, limit: '6' }), signal),
}
