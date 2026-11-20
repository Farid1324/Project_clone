import { ChevronDown, LoaderCircle, ShoppingCart, Star, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Offer, Product } from '../types/api'
import { formatCount, formatMoney } from '../lib/format'
import { cartErrorMessage, useAddToCart, useCart, useCartBusy } from '../hooks/useCart'

export function SellerOfferCard({ offer, product, bestPrice = false }: { offer: Offer; product: Product; bestPrice?: boolean }) {
  const cart = useCart()
  const add = useAddToCart(product.slug)
  const busy = useCartBusy()
  const currentQuantity = cart.data?.data.items.find(item => item.offer_id === offer.id)?.quantity ?? 0
  const limit = cart.data?.data.limits.quantity_per_offer ?? 0
  const full = currentQuantity >= Math.min(offer.stock_available, limit)
  return <article className={'seller-offer' + (bestPrice ? ' seller-offer-best' : '') + (!offer.is_available ? ' seller-offer-unavailable' : '')} aria-label={'Offer from ' + offer.seller.name} data-offer-id={offer.id}>
    {bestPrice && <span className="best-price-label">LOWEST AVAILABLE PRICE</span>}
    <div className="seller-offer-main">
      <span className="seller-avatar" aria-hidden="true"><Store size={24} /></span>
      <div className="seller-identity"><h3>{offer.seller.name}</h3><p className="seller-rating"><Star size={15} fill="currentColor" aria-hidden="true" /><strong>{offer.seller.rating.toFixed(2)}</strong><span>/ 5 · {formatCount(offer.seller.rating_count)} ratings</span></p></div>
      <div className="seller-offer-price"><strong>{formatMoney(offer.price_minor)}</strong><span className={offer.is_available ? 'stock-label' : 'muted'}>{offer.is_available ? offer.stock_available + ' demo keys available' : 'Out of stock'}</span></div>
      <button type="button" className="button button-primary offer-add" aria-label={(offer.is_available ? 'Add to cart from ' : 'Sold out from ') + offer.seller.name}
        disabled={!offer.is_available || !cart.data || cart.isError || busy || full} onClick={() => add.mutate(offer.id)}>
        {add.isPending ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <ShoppingCart size={18} aria-hidden="true" />}
        {!offer.is_available ? 'Sold out' : add.isPending ? 'Adding…' : cart.isError ? 'Cart unavailable' : !cart.data ? 'Loading cart…' : full ? 'Quantity limit reached' : 'Add to cart'}
      </button>
    </div>
    {add.isSuccess && <p className="offer-feedback" role="status">Added from {offer.seller.name}. <Link to="/cart">View cart</Link></p>}
    {add.isError && <p className="offer-feedback field-error" role="alert">{cartErrorMessage(add.error)} <Link to="/cart">Review cart</Link></p>}
    {cart.isError && <p className="offer-feedback"><Link to="/cart">Open your cart to reconnect.</Link></p>}
    <details className="offer-details"><summary>Offer information<ChevronDown size={16} aria-hidden="true" /></summary>
      <div><p><strong>{product.platform.name} · {product.region.name}</strong></p><p>{product.activation_notice}</p><p>Prices and seller ratings are fictional demo data. Adding to your cart does not reserve inventory.</p></div>
    </details>
  </article>
}
