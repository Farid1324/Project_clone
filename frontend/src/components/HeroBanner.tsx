import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Banner } from '../types/api'
import { MarketplaceImage } from './MarketplaceImage'

const destination = (banner: Banner) => banner.destination.type === 'product' && banner.destination.product_slug ? '/products/' + banner.destination.product_slug : '/store'
export function HeroBanner({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)
  if (!banners.length) return null
  const activeIndex = index % banners.length
  const active = banners[activeIndex]
  const next = banners[(activeIndex + 1) % banners.length]
  return <section className="hero" aria-label="Marketplace promotions" aria-roledescription="carousel">
    <div className="hero-track">
      <div className="hero-main" aria-live="polite" aria-atomic="true">
        <MarketplaceImage src={active.image_url} alt={active.image_alt} fetchPriority="high" className="hero-image" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">FEATURED PROMOTION</span>
          <h2>{active.title}</h2>
          {active.subtitle && <p>{active.subtitle}</p>}
          <Link to={destination(active)} className="button button-primary">Explore offers</Link>
        </div>
        <span className="hero-art-label">Original demo artwork</span>
      </div>
      {banners.length > 1 && <button type="button" className="hero-preview" onClick={() => setIndex((activeIndex + 1) % banners.length)} aria-label={'Show promotion: ' + next.title}>
        <MarketplaceImage src={next.image_url} alt="" />
        <span className="hero-preview-shade" />
        <span className="hero-preview-copy"><small>UP NEXT</small><strong>{next.title}</strong><span>Explore this collection</span></span>
      </button>}
    </div>
    {banners.length > 1 && <div className="hero-pagination" aria-label="Choose promotion">
      {banners.map((banner, slide) => <button key={banner.id} type="button" className={slide === activeIndex ? 'hero-dot is-current' : 'hero-dot'}
        aria-label={'Show promotion ' + (slide + 1) + ': ' + banner.title} aria-current={slide === activeIndex ? 'true' : undefined} onClick={() => setIndex(slide)}><span /></button>)}
    </div>}
  </section>
}
