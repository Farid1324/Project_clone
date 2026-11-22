import { Gamepad2, Globe2, KeyRound, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from './Brand'
import { storeUrl } from '../lib/format'
import { useFilters } from '../hooks/useCatalog'

export function Footer() {
  const filters = useFilters()
  return <footer className="site-footer">
    <div className="footer-benefits market-container"><span><Gamepad2 aria-hidden="true" />Digital games & gift cards</span><span><ShieldCheck aria-hidden="true" />Compare independent sellers</span><span><Globe2 aria-hidden="true" />Clear activation regions</span></div>
    <div className="market-container footer-main">
      <div className="footer-brand"><Brand /><p>Your next game. Your choice of seller.</p><span className="footer-demo-tag"><KeyRound size={15} aria-hidden="true" />Independent internship project</span></div>
      <nav aria-label="Explore marketplace"><h2>Explore</h2><Link to="/store">All products</Link><Link to={storeUrl({ type: 'game' })}>Games</Link><Link to={storeUrl({ type: 'gift_card' })}>Gift cards</Link><Link to="/#deals">Deals</Link></nav>
      <nav aria-label="Browse platforms"><h2>Platforms</h2>{filters.data?.data.platforms.map(platform => <Link key={platform.id} to={storeUrl({ 'platforms[]': [platform.slug] })}>{platform.name}</Link>)}</nav>
      <nav aria-label="Demo information"><h2>Good to know</h2><Link to="/about">About this demo</Link><Link to="/about#activation">Activation explained</Link><Link to="/about#privacy">Privacy in this demo</Link><a href="https://www.eneba.com/" target="_blank" rel="noreferrer">Visit official Eneba<span className="sr-only"> (opens in a new tab)</span></a></nav>
    </div>
    <div className="market-container footer-bottom"><p>Keymarket is an independent internship demo. Not affiliated with or endorsed by Eneba. Game artwork belongs to its respective owners; no real purchases or redeemable keys.</p><span>English EU · EUR</span></div>
  </footer>
}
