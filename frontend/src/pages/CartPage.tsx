import { LoaderCircle, Minus, Plus, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AsyncState } from '../components/AsyncState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { cartErrorMessage, useCart, useCartBusy, useRemoveCartItem, useUpdateCartItem } from '../hooks/useCart'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatMoney } from '../lib/format'
import type { CartItem } from '../types/api'
import { useSession } from '../hooks/useSession'
import { MarketplaceImage } from '../components/MarketplaceImage'

function CartLine({ item, limit }: { item: CartItem; limit: number }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = useCartBusy()
  const label = item.product.title + ' from ' + item.seller.name
  function quantity(value: number) { remove.reset(); update.reset(); update.mutate({ id: item.id, quantity: value }) }
  const error = update.error ?? remove.error
  return <article className="cart-line" data-offer-id={item.offer_id} aria-label={label}>
    <Link className="cart-line-art" to={'/products/' + item.product.slug}><MarketplaceImage src={item.product.cover_image_url} alt={item.product.title} width={75} height={100} /></Link>
    <div className="cart-line-copy"><Link className="cart-product-title" to={'/products/' + item.product.slug}>{item.product.title}</Link>
      <p>{item.product.platform.name} · {item.product.region.name}</p><p>Seller: <strong>{item.seller.name}</strong></p>
      <p>{formatMoney(item.unit_price_minor)} each · {item.stock_available} demo keys available</p>
      {!item.is_available && <p className="field-error" role="status">This offer needs attention. Reduce the quantity or remove the unavailable item.</p>}
    </div>
    <div className="cart-line-controls"><strong className="cart-line-total">{formatMoney(item.line_total_minor)}</strong>
      <div className="quantity-control" role="group" aria-label={'Quantity of ' + label}>
        <button type="button" className="icon-button" aria-label={'Decrease quantity of ' + label} disabled={busy || item.quantity <= 1} onClick={() => quantity(item.quantity - 1)}><Minus size={16} aria-hidden="true" /></button>
        <span>{item.quantity}</span>
        <button type="button" className="icon-button" aria-label={'Increase quantity of ' + label} disabled={busy || !item.is_available || item.quantity >= Math.min(item.stock_available, limit)} onClick={() => quantity(item.quantity + 1)}><Plus size={16} aria-hidden="true" /></button>
      </div>
      <button type="button" className="text-button remove-cart-item" aria-label={'Remove ' + label} disabled={busy} onClick={() => { update.reset(); remove.mutate(item.id) }}><Trash2 size={16} aria-hidden="true" />Remove</button>
    </div>
    {error && <p className="cart-line-error field-error" role="alert">{cartErrorMessage(error)}</p>}
  </article>
}

export function CartPage() {
  usePageTitle('Your cart')
  const cart = useCart()
  const session = useSession()
  const location = useLocation()
  const busy = useCartBusy()
  return <div className="market-container cart-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>Cart</span></nav>
    <div className="section-heading"><div><p className="eyebrow">YOUR CHOICE OF SELLER</p><h1>Your cart</h1></div><Link to="/store" className="text-link">Continue browsing</Link></div>
    {location.state?.notices?.map((notice: string) => <p role="status" className="checkout-notice" key={notice}>{notice}</p>)}
    {cart.isPending ? <LoadingSkeleton variant="line" count={4} />
      : cart.isError ? <AsyncState title="Your cart could not load" message={cart.error.message} onRetry={() => void cart.refetch()} />
        : cart.data.data.items.length === 0 ? <div className="empty-cart"><ShoppingCart size={44} aria-hidden="true" /><h2>Your cart is empty</h2><p>Choose an available seller offer on a product page.</p><Link to="/store" className="button button-primary">Browse the catalog</Link></div>
          : <div className="cart-layout"><section aria-label="Selected seller offers" className="cart-lines">{cart.data.data.items.map(item => <CartLine key={item.id} item={item} limit={cart.data.data.limits.quantity_per_offer} />)}</section>
            <aside className="cart-summary" aria-label="Cart summary"><h2>Cart summary</h2><p className="cart-total" role="status"><span>{cart.data.data.items_count} {cart.data.data.items_count === 1 ? 'key' : 'keys'}</span><strong>{formatMoney(cart.data.data.total_minor)}</strong></p>
              <p>Current seller prices. Cart items do not reserve stock.</p>
              {cart.data.data.has_unavailable_items && <p className="field-error">Some selected offers need attention.</p>}
              <button type="button" className="button button-secondary" disabled={busy || cart.isFetching} onClick={() => void cart.refetch()}>{cart.isFetching ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}Refresh cart</button>
              {!cart.data.data.has_unavailable_items && <Link className="button button-primary" to={session.data?.data.user ? '/checkout' : '/login?returnTo=%2Fcheckout'}>{session.data?.data.user ? 'Continue to checkout' : 'Sign in to checkout'}</Link>}
              <div className="cart-demo-note"><strong>Simulated payments only</strong><p>No real money or credit cards. Successful demo payments deliver nonredeemable keys to your account.</p></div>
            </aside></div>}
  </div>
}
