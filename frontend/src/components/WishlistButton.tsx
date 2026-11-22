import { Heart, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWishlistBusy, useWishlistMutation, useWishlistSummary } from '../hooks/useWishlist'
import type { Product } from '../types/api'

export function WishlistButton({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { session, userId, summary } = useWishlistSummary()
  const mutation = useWishlistMutation(userId)
  const busy = useWishlistBusy(userId)
  const navigate = useNavigate()
  const saved = Boolean(userId && summary.data?.data.product_ids.includes(product.id))
  const loading = session.isPending || (Boolean(userId) && summary.isPending)
  const unknown = session.isError || (Boolean(userId) && !summary.isSuccess)
  const retry = session.isError || summary.isError
  const label = retry ? 'Retry wishlist status for ' + product.title : saved ? 'Remove ' + product.title + ' from wishlist' : 'Save ' + product.title + ' to wishlist'
  function toggle() {
    if (session.isError) { void session.refetch(); return }
    if (!userId) { navigate('/login?' + new URLSearchParams({ returnTo: '/wishlist?save=' + product.id })); return }
    if (summary.isError) { void summary.refetch(); return }
    mutation.mutate({ productId: product.id, saved })
  }
  return <div className={'wishlist-control' + (compact ? ' wishlist-control-card' : '')}>
    <button type="button" className={'wishlist-button' + (saved ? ' is-saved' : '') + (compact ? ' wishlist-button-icon' : '')}
      aria-label={label} aria-pressed={unknown ? undefined : saved} aria-busy={mutation.isPending}
      disabled={loading || busy || (unknown && summary.isFetching)} onClick={toggle} title={label}>
      {loading || mutation.isPending ? <LoaderCircle size={21} className="spin" aria-hidden="true" /> : <Heart size={21} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />}
      {!compact && <span>{retry ? 'Retry wishlist' : saved ? 'Saved to wishlist' : 'Save to wishlist'}</span>}
    </button>
    {mutation.isError && <p role="alert" className="wishlist-feedback">{mutation.error.message} Select the heart to try again.</p>}
    {mutation.isSuccess && <span className="sr-only" role="status">{saved ? 'Saved to your wishlist.' : 'Removed from your wishlist.'}</span>}
  </div>
}
