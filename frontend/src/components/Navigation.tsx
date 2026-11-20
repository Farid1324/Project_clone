import { Gamepad2, Gift, Tag } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useFilters } from '../hooks/useCatalog'
import { storeUrl } from '../lib/format'

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const filters = useFilters()
  const location = useLocation()
  const links = [
    { label: 'Discover', to: '/', icon: Gamepad2 },
    { label: 'All games', to: storeUrl({ type: 'game' }), icon: null },
    { label: 'Gift cards', to: storeUrl({ type: 'gift_card' }), icon: Gift },
    { label: 'Deals', to: '/#deals', icon: Tag },
    ...(filters.data?.data.platforms ?? []).map(platform => ({ label: platform.name, to: storeUrl({ 'platforms[]': [platform.slug] }), icon: null })),
  ]
  return <nav aria-label="Main navigation" className="navigation">
    {links.map(({ label, to, icon: Icon }) => <Link key={to} to={to} onClick={onNavigate}
      className={location.pathname + location.search + location.hash === to ? 'nav-link is-current' : 'nav-link'}>
      {Icon && <Icon size={18} aria-hidden="true" />}{label}
    </Link>)}
  </nav>
}
