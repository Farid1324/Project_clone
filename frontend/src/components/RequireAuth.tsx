import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { AsyncState } from './AsyncState'
import { LoadingSkeleton } from './LoadingSkeleton'

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (session.isPending) return <div className="market-container auth-loading"><LoadingSkeleton variant="line" count={3} /></div>
  if (session.isError) return <div className="market-container auth-loading"><AsyncState title="Your session could not load" message={session.error.message} onRetry={() => void session.refetch()} /></div>
  if (!session.data.data.user) return <div className="market-container auth-page"><h1>Sign in to continue</h1><p>Your wishlist, checkout and purchased demo keys belong to your account.</p><Link className="button button-primary" to={'/login?' + new URLSearchParams({ returnTo: location.pathname + (location.pathname === '/wishlist' ? location.search : '') })}>Sign in</Link></div>
  return children
}
