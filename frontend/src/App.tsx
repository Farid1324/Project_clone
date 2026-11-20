import { useEffect } from 'react'
import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { HomePage } from './pages/HomePage'
import { StorePage } from './pages/StorePage'
import { ProductPage } from './pages/ProductPage'
import { AboutPage } from './pages/AboutPage'
import { CartPage } from './pages/CartPage'
import { AuthPage } from './pages/AuthPage'
import { AccountPage } from './pages/AccountPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderPage, OrdersPage } from './pages/OrdersPage'

function NavigationScroll() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView())
    else window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

function Layout() {
  return <><NavigationScroll /><Header /><main id="main-content" tabIndex={-1}><Outlet /></main><Footer /></>
}

function RouteError() {
  return <div className="market-container error-page"><h1>The page could not be displayed</h1><p>Please reload to reconnect to the marketplace.</p>
    <button className="button button-primary" onClick={() => window.location.assign('/')}>Reload the marketplace</button></div>
}

const router = createBrowserRouter([{
  element: <Layout />,
  errorElement: <RouteError />,
  children: [
    { index: true, element: <HomePage /> },
    { path: '/store', element: <StorePage /> },
    { path: '/products/:slug', element: <ProductPage /> },
    { path: '/about', element: <AboutPage /> },
    { path: '/cart', element: <CartPage /> },
    { path: '/login', element: <AuthPage /> },
    { path: '/register', element: <AuthPage register /> },
    { path: '/account', element: <AccountPage /> },
    { path: '/checkout', element: <CheckoutPage /> },
    { path: '/orders', element: <OrdersPage /> },
    { path: '/orders/:orderId', element: <OrderPage /> },
    { path: '*', element: <div className="market-container error-page"><h1>Page not found</h1><p>This page is not part of the internship demo.</p><Link className="button button-primary" to="/">Back to discovery</Link></div> },
  ],
}])

export default function App() {
  return <RouterProvider router={router} />
}
