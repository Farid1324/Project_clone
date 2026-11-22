import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { RequireAuth } from '../components/RequireAuth'
import { AsyncState } from '../components/AsyncState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ProductGrid } from '../components/ProductGrid'
import { useWishlistMutation, useWishlistProducts, useWishlistSummary } from '../hooks/useWishlist'
import { usePageTitle } from '../hooks/usePageTitle'

function SavedProducts() {
  const { userId, summary } = useWishlistSummary()
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page') ?? 1)
  const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1
  const query = useWishlistProducts(userId, page)
  const save = useWishlistMutation(userId)
  const { mutate } = save
  const intent = params.get('save')
  const handled = useRef<string | null>(null)
  function saveIntent() {
    if (!intent) return
    mutate({ productId: intent, saved: false }, { onSuccess: () => setParams({}, { replace: true }) })
  }
  useEffect(() => {
    if (!userId || !intent || handled.current === userId + intent) return
    handled.current = userId + intent
    mutate({ productId: intent, saved: false }, { onSuccess: () => setParams({}, { replace: true }) })
  }, [userId, intent, mutate, setParams])
  if (!userId) return null
  return <div className="market-container wishlist-page">
    <div className="section-heading wishlist-heading"><div><p className="eyebrow">SAVED FOR LATER</p><h1><Heart size={29} aria-hidden="true" />Your wishlist</h1><p>Save products, then compare current seller offers when you are ready.</p></div><Link className="text-link" to="/store">Browse the catalog</Link></div>
    <p className="wishlist-summary" role="status">{summary.isSuccess ? summary.data.data.count + (summary.data.data.count === 1 ? ' saved product' : ' saved products') : 'Your saved products stay with this account.'}</p>
    {save.isPending && <p role="status" className="wishlist-intent-status">Saving the product you selected before sign-in…</p>}
    {save.isError && intent && <AsyncState title="The selected product could not be saved" message={save.error.message} onRetry={saveIntent} />}
    {query.isPending ? <div aria-label="Loading saved products" aria-busy="true"><LoadingSkeleton count={6} /></div>
      : query.isError ? <AsyncState title="Your wishlist could not load" message={query.error.message} onRetry={() => void query.refetch()} />
        : query.data.data.length ? <ProductGrid products={query.data.data} label="Saved products" />
          : <div className="wishlist-empty"><AsyncState title={page > 1 ? 'No saved products on this page' : 'Your wishlist is ready for its first game'} message={page > 1 ? 'Return to the first page to see your saved products.' : 'Select a heart on any product to keep it here. Prices and availability update from the marketplace.'} />
            <Link className="button button-primary" to={page > 1 ? '/wishlist' : '/store'}>{page > 1 ? 'First page' : 'Discover products'}</Link></div>}
    {query.isSuccess && query.data.meta.last_page > 1 && <nav className="pagination" aria-label="Wishlist pages">
      <button className="button button-secondary" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span>
      <button className="button button-secondary" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ page: String(page + 1) })}>Next</button>
    </nav>}
  </div>
}

export function WishlistPage() {
  usePageTitle('Your wishlist')
  return <RequireAuth><SavedProducts /></RequireAuth>
}
