import { Castle, Compass, Crosshair, Gift, Joystick, Rocket, Sparkles, Swords, Trophy, CarFront } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePopularCategories } from '../hooks/useCatalog'
import { storeUrl } from '../lib/format'
import { AsyncState } from './AsyncState'

const icons = { action: Swords, adventure: Compass, rpg: Castle, strategy: Trophy, simulation: Joystick, indie: Sparkles, racing: CarFront, shooter: Crosshair, 'gift-cards': Gift }
export function CategoryNavigation() {
  const categories = usePopularCategories()
  return <section id="popular-categories" aria-labelledby="popular-categories-heading" aria-busy={categories.isPending}>
    <h2 id="popular-categories-heading" className="sr-only">Popular categories</h2>
    {categories.isError ? <div className="market-container category-error"><AsyncState compact title="Categories are unavailable" message="You can still browse the catalog." onRetry={() => void categories.refetch()} /><Link className="text-link" to="/store">Browse the catalog</Link></div>
      : !categories.isPending && categories.data.data.length === 0 ? <div className="market-container category-error"><AsyncState compact title="No popular categories yet" message="Categories will appear when they contain available products." /><Link className="text-link" to="/store">Browse the catalog</Link></div>
        : <nav className="market-container category-navigation" aria-label="Browse popular categories">
          <Link to="/store" className="category-link"><Rocket size={30} strokeWidth={1.6} aria-hidden="true" /><span>All products</span></Link>
          {categories.isPending ? <div className="category-loading" role="status" aria-label="Loading popular categories"><span className="sr-only">Loading…</span>{Array.from({ length: 7 }, (_, index) => <span key={index} className="category-placeholder skeleton" aria-hidden="true" />)}</div>
            : categories.data.data.map(category => {
              const Icon = icons[category.slug as keyof typeof icons] ?? Joystick
              return <Link key={category.id} to={storeUrl({ 'categories[]': [category.slug] })} className="category-link"><Icon size={30} strokeWidth={1.6} aria-hidden="true" /><span>{category.name}</span></Link>
            })}
        </nav>}
  </section>
}
