export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  products_count?: number
}
export interface Platform { id: string; name: string; slug: string }
export interface Region { id: string; name: string; code: string; activation_notice?: string }
export interface Promotion {
  id: string
  slug: string
  title: string
  description: string
  image_url: string
  starts_at: string | null
  ends_at: string | null
  available_offer_count: number
}
export interface Seller { id: string; name: string; rating: number; rating_count: number }
export interface Offer {
  id: string
  product_id: string
  seller: Seller
  price_minor: number
  comparison_price_minor: number | null
  currency: 'EUR'
  stock_available: number
  is_available: boolean
  promotions: Pick<Promotion, 'id' | 'slug' | 'title'>[]
}
export interface Product {
  id: string
  slug: string
  title: string
  type: 'game' | 'gift_card'
  cover_image_url: string
  platform: Platform
  region: Region
  categories: Category[]
  price_minor: number | null
  comparison_price_minor: number | null
  discount_percent: number | null
  currency: 'EUR'
  available_offer_count: number
  is_available: boolean
  is_published?: boolean
  description?: string
  edition?: string | null
  publisher?: string | null
  release_date?: string | null
  activation_instructions?: string
  activation_notice?: string
  offers?: Offer[]
  requirements?: ProductRequirements | null
  delivery_information?: string | null
  compatibility_notice?: string | null
}
export interface Requirement { label: string; value: string }
export interface ProductRequirements {
  kind: 'pc' | 'activation'
  minimum: Requirement[]
  recommended: Requirement[]
  notes: string[]
  source_url?: string | null
  captured_at?: string | null
}
export interface CartItem {
  id: string
  offer_id: string
  quantity: number
  product: Pick<Product, 'id' | 'slug' | 'title' | 'cover_image_url' | 'platform' | 'region'>
  seller: Seller
  unit_price_minor: number
  line_total_minor: number
  stock_available: number
  is_available: boolean
}
export interface Cart {
  id: string | null
  version: number
  currency: 'EUR'
  items: CartItem[]
  items_count: number
  total_minor: number
  has_unavailable_items: boolean
  limits: { quantity_per_offer: number; distinct_offers: number }
}
export interface Banner {
  id: string
  title: string
  subtitle: string | null
  image_url: string
  image_alt: string
  destination: { type: 'store' | 'product'; product_slug: string | null }
}
export interface Envelope<T> { data: T }
export interface WishlistSummary { count: number; product_ids: string[] }
export interface Session { user: { id: string; name: string; email: string } | null; cart_merge_notices: string[] }
export interface CheckoutQuote { cart: Cart; quote_token: string; checked_at: string; expires_at: string }
export interface PurchaseRequest { quote_token: string; idempotency_key: string; scenario: 'approve' | 'decline' }
export interface OrderItem {
  id: string; offer_id: string; product_title: string; seller_name: string; platform_name: string; region_name: string
  quantity: number; unit_price_minor: number; line_total_minor: number; keys?: string[]
}
export interface Order {
  id: string; status: 'fulfilled' | 'payment_failed'; currency: 'EUR'; total_minor: number; created_at: string; fulfilled_at: string | null
  payment: { provider: 'simulated'; status: 'approved' | 'declined'; reference: string }; items: OrderItem[]
}
export interface Paginated<T> extends Envelope<T[]> {
  meta: { current_page: number; last_page: number; per_page: number; total: number }
  links: { next: string | null; prev: string | null }
}
export interface CatalogFilters {
  categories: Category[]
  platforms: Platform[]
  regions: Region[]
}
