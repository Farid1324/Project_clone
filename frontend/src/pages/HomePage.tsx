import { Link } from 'react-router-dom'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Envelope, Product } from '../types/api'
import { useBanners, useBestSellers, useDeals, useGiftCards, useRecommendations } from '../hooks/useCatalog'
import { HeroBanner } from '../components/HeroBanner'
import { CategoryNavigation } from '../components/CategoryNavigation'
import { ProductGrid } from '../components/ProductGrid'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AsyncState } from '../components/AsyncState'
import { storeUrl } from '../lib/format'
import { usePageTitle } from '../hooks/usePageTitle'

function ProductSection({ id, title, subtitle, query, browseTo = '/store' }: {
  id: string; title: string; subtitle: string; query: UseQueryResult<Envelope<Product[]>, Error>; browseTo?: string
}) {
  const recommended = id === 'best-sellers'
  return <section className="market-section market-container" id={id} aria-labelledby={id + '-heading'} aria-busy={query.isPending}>
    <div className="section-heading"><div><h2 id={id + '-heading'}>{title}</h2><p className="sr-only">{subtitle}</p></div><Link to={browseTo} className="text-link">Browse catalog</Link></div>
    {query.isPending ? <LoadingSkeleton count={5} recommended={recommended} />
      : query.isError ? <AsyncState title={title + ' could not load'} message="The rest of the marketplace is still available." onRetry={() => void query.refetch()} />
        : query.data.data.length === 0 ? <div><AsyncState title="Nothing here just yet" message="Check back for new offers or explore the full catalog." /><Link to={browseTo} className="text-link">Explore the catalog</Link></div>
          : <ProductGrid products={query.data.data.slice(0, 5)} label={title} recommended={recommended} />}
  </section>
}

export function HomePage() {
  usePageTitle('Discover your next game')
  const banners = useBanners()
  const bestSellers = useBestSellers()
  const deals = useDeals()
  const giftCards = useGiftCards()
  const recommendations = useRecommendations()
  return <>
    <h1 className="sr-only">Discover games and gift cards at Keymarket</h1>
    <div id="promotional-banners" aria-busy={banners.isPending}>
      {banners.isPending ? <LoadingSkeleton variant="hero" /> : banners.isError
        ? <div className="market-container hero-error"><AsyncState title="Promotions could not load" message="Browse the catalog while we reconnect." onRetry={() => void banners.refetch()} /><Link className="text-link" to="/store">Browse the catalog</Link></div>
        : banners.data.data.length ? <HeroBanner banners={banners.data.data} /> : <div className="market-container empty-hero"><AsyncState title="No active promotions" message="Explore the available catalog while we prepare the next promotion." compact /><Link className="button button-primary" to="/store">Explore the catalog</Link></div>}
    </div>
    <CategoryNavigation />
    <ProductSection id="best-sellers" title="Best sellers" subtitle="Most-purchased games in completed demo orders over the last 30 days." query={bestSellers} browseTo={storeUrl({ type: 'game' })} />
    <ProductSection id="deals" title="Deals worth discovering" subtitle="Stocked discounted offers in current promotions." query={deals} />
    <ProductSection id="gift-cards" title="Popular gift cards" subtitle="Wallet credit ranked by completed demo sales." query={giftCards} browseTo={storeUrl({ type: 'gift_card' })} />
    <ProductSection id="recommendations" title="Recommended products" subtitle="Discovery picks based on available sellers, seller ratings and release dates; the same ranking for every visitor." query={recommendations} />
  </>
}
