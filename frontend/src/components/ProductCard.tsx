import { Link, useLocation } from 'react-router-dom'
import type { Product } from '../types/api'
import { formatMoney } from '../lib/format'
import { PlatformBadge } from './PlatformBadge'
import { MarketplaceImage } from './MarketplaceImage'

export function ProductCard({ product }: { product: Product }) {
  const location = useLocation()
  return <article className="product-card" data-product-id={product.id}>
    <Link to={'/products/' + product.slug} state={{ from: location.pathname + location.search }} className="product-card-link">
      <div className="product-cover">
        <MarketplaceImage src={product.cover_image_url} alt="" loading="lazy" width={600} height={800} />
        {product.discount_percent !== null && product.discount_percent > 0 && <span className="discount-badge">−{product.discount_percent}%</span>}
        {product.type === 'gift_card' && <span className="kind-badge">GIFT CARD</span>}
      </div>
      <PlatformBadge platform={product.platform} giftCard={product.type === 'gift_card'} />
      <div className="product-card-body">
        <h3>{product.title}</h3>
        <span className="region-label">{product.region.name}</span>
        <div className="card-pricing">
          <div className="card-price-caption">From {product.comparison_price_minor !== null && product.comparison_price_minor > (product.price_minor ?? Infinity) && <del>{formatMoney(product.comparison_price_minor)}</del>}</div>
          <strong className={product.price_minor === null ? 'unavailable-price' : 'product-price'}>{product.price_minor === null ? 'Unavailable' : formatMoney(product.price_minor)}</strong>
          <span className="offer-count">{product.available_offer_count} {product.available_offer_count === 1 ? 'seller offer' : 'seller offers'}</span>
        </div>
      </div>
    </Link>
  </article>
}
