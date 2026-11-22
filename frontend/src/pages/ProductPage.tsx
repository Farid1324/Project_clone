import { Link, useParams } from 'react-router-dom'
import { CircleCheck, Info } from 'lucide-react'
import { useProduct } from '../hooks/useCatalog'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AsyncState } from '../components/AsyncState'
import { PlatformBadge } from '../components/PlatformBadge'
import { SellerOfferCard } from '../components/SellerOfferCard'
import { formatMoney, storeUrl } from '../lib/format'
import { usePageTitle } from '../hooks/usePageTitle'
import { ApiError } from '../lib/api'
import { ProductRequirements } from '../components/ProductRequirements'
import { MarketplaceImage } from '../components/MarketplaceImage'
import { WishlistButton } from '../components/WishlistButton'

export function ProductPage() {
  const { slug = '' } = useParams()
  const query = useProduct(slug)
  usePageTitle(query.data?.data.title ?? 'Product')
  if (query.isPending) return <div className="market-container detail-loading"><LoadingSkeleton variant="hero" /><LoadingSkeleton variant="line" count={3} /></div>
  if (query.isError) return <div className="market-container error-page"><AsyncState title={query.error instanceof ApiError && query.error.status === 404 ? 'Product not found' : 'Product could not load'} message={query.error.message}
    onRetry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => void query.refetch()} /><Link className="button button-primary" to="/store">Browse the catalog</Link></div>
  const product = query.data.data
  const offers = [...(product.offers ?? [])].sort((a, b) => a.price_minor - b.price_minor || a.id.localeCompare(b.id))
  return <div className="market-container product-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/store">Catalog</Link><span aria-hidden="true">/</span><span>{product.title}</span></nav>
    <nav className="product-sections" aria-label="Product information"><a href="#seller-offers-heading">Seller offers</a><a href="#requirements-heading">Requirements</a><a href="#delivery-heading">Delivery</a><a href="#activation-heading">Activation</a></nav>
    <div className="product-detail-grid">
      <div className="detail-art"><MarketplaceImage src={product.cover_image_url} alt={'Cover artwork for ' + product.title} width={600} height={900} fetchPriority="high" /><PlatformBadge platform={product.platform} giftCard={product.type === 'gift_card'} /></div>
      <div className="detail-copy"><p className="eyebrow">{product.type === 'gift_card' ? 'DIGITAL GIFT CARD' : 'DIGITAL GAME'} · {product.region.name}</p><h1>{product.title}</h1>
        <div className="detail-tags"><span><CircleCheck size={16} aria-hidden="true" />{product.platform.name}</span><span>{product.region.name}</span>{product.edition && <span>{product.edition} edition</span>}</div>
        <p className="detail-description">{product.description}</p>
        <div className="detail-price"><span>Available from</span><strong>{product.price_minor === null ? 'Currently unavailable' : formatMoney(product.price_minor)}</strong><span>{product.available_offer_count} independent seller offers</span></div>
        <WishlistButton product={product} />
        <div className="activation-notice"><Info size={22} aria-hidden="true" /><div><h2>Check your activation region</h2><p>{product.activation_notice}</p></div></div>
        <div className="compatibility-notice"><h2>Platform compatibility</h2><p>{product.compatibility_notice ?? 'Confirm the exact platform and edition before a real purchase.'}</p></div>
        <div className="detail-category-links">{product.categories.map(category => <Link key={category.id} to={storeUrl({ 'categories[]': [category.slug] })}>{category.name}</Link>)}</div>
      </div>
    </div>
    <section className="offers-section" aria-labelledby="seller-offers-heading"><div className="section-heading"><div><h2 id="seller-offers-heading">Compare seller offers</h2><p>Same product. Independent prices, ratings, and availability.</p></div></div>
      <div className="demo-purchase-notice"><Info size={18} aria-hidden="true" /><p>Choose a seller, sign in, and simulate payment. Only nonredeemable demo keys are delivered; no real money is processed.</p></div>
      <p className="offers-order">Sorted by price: low to high</p>
      {!product.is_available && <p className="unavailable-product" role="status">This product is currently unavailable. Sold-out offers cannot be added to your cart.</p>}
      {offers.length ? <div className="seller-offer-list">{offers.map(offer => <SellerOfferCard key={offer.id} offer={offer} product={product} bestPrice={offer.is_available && offer.price_minor === product.price_minor} />)}</div>
        : <AsyncState title="No seller offers are currently available" message="Explore the catalog for other products." />}
    </section>
    <section className="product-info-section" aria-labelledby="delivery-heading"><h2 id="delivery-heading">Digital delivery</h2><p>{product.delivery_information ?? 'Digital key format. This demo does not process payments or deliver redeemable keys.'}</p></section>
    <ProductRequirements requirements={product.requirements} />
    <section className="activation-section" aria-labelledby="activation-heading"><h2 id="activation-heading">Activation instructions</h2><ol className="activation-steps">{product.activation_instructions?.split('\n').filter(Boolean).map((step, index) => <li key={index}>{step}</li>)}</ol><Link to="/about#activation" className="text-link">How activation works in this demo</Link></section>
  </div>
}
