import { useState } from 'react'
import { Globe2, Info, Menu, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from './Brand'
import { Navigation } from './Navigation'
import { SearchBar } from './SearchBar'
import { Dialog } from './Dialog'
import { useCart } from '../hooks/useCart'
import { useSession } from '../hooks/useSession'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const cart = useCart()
  const session = useSession()
  const count = cart.data?.data.items_count ?? 0
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <div className="demo-strip"><span className="demo-label">INTERNSHIP DEMO</span><span aria-hidden="true">·</span><span>No real purchases</span></div>
      <div className="market-container header-main">
        <button type="button" className="icon-button mobile-only" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" /></button>
        <Brand />
        <div className="desktop-search"><SearchBar /></div>
        <div className="header-tools">
          <span className="locale"><Globe2 size={17} aria-hidden="true" /><span className="locale-language">English EU</span><span className="locale-divider" aria-hidden="true">|</span> EUR</span>
          <button type="button" className="icon-button mobile-only" aria-label={searchOpen ? 'Close search' : 'Open search'} aria-expanded={searchOpen} onClick={() => setSearchOpen(open => !open)}>
            {searchOpen ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
          </button>
          <Link to="/cart" className="icon-button cart-link" aria-label={'Cart, ' + count + (count === 1 ? ' item' : ' items')}><ShoppingCart size={23} aria-hidden="true" />{count > 0 && <span className="cart-count" aria-hidden="true">{count}</span>}</Link>
          <Link to={session.data?.data.user ? '/account' : '/login'} className="icon-button account-link" aria-label={session.data?.data.user ? 'Your account' : 'Sign in'}><UserRound size={23} aria-hidden="true" /></Link>
          <Link to="/about" className="demo-help" aria-label="About the demo"><Info size={23} aria-hidden="true" /><span>About the demo</span></Link>
        </div>
      </div>
      {searchOpen && <div className="market-container mobile-search"><SearchBar autoFocus onNavigate={() => setSearchOpen(false)} /></div>}
      <div className="desktop-navigation"><div className="market-container"><Navigation /></div></div>
    </header>
    <Dialog title="Explore Keymarket" open={menuOpen} onClose={() => setMenuOpen(false)}>
      <Navigation onNavigate={() => setMenuOpen(false)} />
      <Link to="/about" onClick={() => setMenuOpen(false)} className="drawer-about">About this independent internship demo</Link>
    </Dialog>
  </>
}
