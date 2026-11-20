import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AsyncState } from '../components/AsyncState'
import { useSession } from '../hooks/useSession'
import { useCartBusy } from '../hooks/useCart'
import { usePageTitle } from '../hooks/usePageTitle'
import { api, ApiError } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { CheckoutQuote, PurchaseRequest } from '../types/api'

function readAttempt(key: string): PurchaseRequest | null {
  try { const value = JSON.parse(sessionStorage.getItem(key) ?? 'null'); return value && typeof value.quote_token === 'string' && typeof value.idempotency_key === 'string' && ['approve', 'decline'].includes(value.scenario) ? value : null } catch { return null }
}

function CheckoutContent() {
  const session = useSession()
  const userId = session.data?.data.user?.id
  const storageKey = 'keymarket-pending-checkout:' + userId
  const [pending, setPending] = useState<PurchaseRequest | null>(() => readAttempt(storageKey))
  const [confirmed, setConfirmed] = useState(false)
  const [previous, setPrevious] = useState<CheckoutQuote | null>(null)
  const [message, setMessage] = useState('')
  const cache = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const busy = useCartBusy()
  const quote = useQuery({ queryKey: ['checkout', 'quote', userId], queryFn: ({ signal }) => api.quote(signal), enabled: Boolean(userId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  function remember(attempt: PurchaseRequest | null) {
    setPending(attempt)
    try { if (attempt) sessionStorage.setItem(storageKey, JSON.stringify(attempt)); else sessionStorage.removeItem(storageKey) } catch { /* In-memory retry remains available when browser storage is blocked. */ }
  }
  const payment = useMutation({
    mutationKey: ['checkout', 'write'], mutationFn: api.purchase, retry: false,
    onSuccess: response => {
      remember(null)
      void cache.invalidateQueries({ queryKey: ['cart'] })
      void cache.invalidateQueries({ queryKey: ['orders'] })
      void cache.invalidateQueries({ queryKey: ['product'] })
      navigate('/orders/' + response.data.id, { replace: true })
    },
    onError: error => {
      setConfirmed(false)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        remember(null)
        setMessage(error.message)
        setPrevious(quote.data?.data ?? null)
        if (error.status === 401) {
          cache.setQueryData(['session'], { data: { user: null, cart_merge_notices: [] } })
        } else { void quote.refetch() }
      } else { setMessage('The payment result could not be confirmed. Use “Check payment result” to safely retry the same request, or check your order history.') }
    },
  })
  function pay(scenario: PurchaseRequest['scenario']) {
    if (!userId || !quote.data || !confirmed || pending || payment.isPending) return
    const attempt = { quote_token: quote.data.data.quote_token, idempotency_key: crypto.randomUUID(), scenario }
    remember(attempt)
    setMessage('')
    payment.mutate(attempt)
  }
  const data = quote.data?.data
  const changes = previous && data ? data.cart.items.flatMap(item => {
    const before = previous.cart.items.find(old => old.offer_id === item.offer_id)
    return before && (before.unit_price_minor !== item.unit_price_minor || before.stock_available !== item.stock_available)
      ? [item.product.title + ' from ' + item.seller.name + ': ' + formatMoney(before.unit_price_minor) + ' → ' + formatMoney(item.unit_price_minor) + '; stock ' + before.stock_available + ' → ' + item.stock_available + '.'] : []
  }) : []
  if (!userId) return null
  return <div className="market-container checkout-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/cart">Cart</Link><span aria-hidden="true">/</span><span>Checkout</span></nav><p className="eyebrow">SIMULATED PAYMENT ONLY</p><h1>Review your order</h1><p>No credit cards, real money or redeemable keys. Select a demo payment outcome.</p>
    {location.state?.notices?.map((notice: string) => <p role="status" key={notice} className="checkout-notice">{notice}</p>)}
    {message && <p role="alert" className="checkout-notice">{message}</p>}
    {changes.length > 0 && <div role="status" className="checkout-changes"><h2>Price or stock changes</h2>{changes.map(change => <p key={change}>{change}</p>)}</div>}
    {pending && <section className="pending-payment" aria-labelledby="pending-payment-heading"><h2 id="pending-payment-heading">{payment.isPending ? 'Checking payment…' : 'Payment result needs confirmation'}</h2><p>The same request ID will be reused to prevent a duplicate purchase. This check also works after a page reload.</p><button className="button button-primary" disabled={payment.isPending} onClick={() => payment.mutate(pending)}>Check payment result</button><Link className="text-link" to="/orders">Check order history</Link></section>}
    {quote.isPending ? <LoadingSkeleton variant="line" count={4} /> : quote.isError ? <AsyncState title="Order summary unavailable" message={quote.error.message} onRetry={() => { setConfirmed(false); void quote.refetch() }} />
      : data && <div className="checkout-layout"><section aria-label="Order summary" className="checkout-summary">{data.cart.items.map(item => <article className="checkout-item" key={item.id}><h2>{item.product.title}</h2><p>{item.product.platform.name} · {item.product.region.name}</p><p>Seller: <strong>{item.seller.name}</strong></p><p>{item.quantity} × {formatMoney(item.unit_price_minor)} · {item.stock_available} demo keys available</p><strong>{formatMoney(item.line_total_minor)}</strong>{!item.is_available && <p className="field-error">Insufficient stock or unavailable offer. Update your cart.</p>}</article>)}<p className="checkout-total"><span>Total (EUR)</span><strong>{formatMoney(data.cart.total_minor)}</strong></p><Link className="text-link" to="/cart">Edit your cart</Link></section>
        <aside className="payment-panel"><h2>Demo payment</h2><p>Prices and stock were checked at {new Date(data.checked_at).toLocaleTimeString()}. This quote expires at {new Date(data.expires_at).toLocaleTimeString()}.</p><p>Availability is checked again when you submit. Items are not reserved.</p>
          <label className="checkout-consent"><input type="checkbox" checked={confirmed} disabled={Boolean(pending) || payment.isPending} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the seller prices, stock, platforms and activation regions.</span></label>
          <button className="button button-primary" disabled={!confirmed || Boolean(pending) || busy || quote.isFetching || data.cart.has_unavailable_items} onClick={() => pay('approve')}>Simulate successful payment</button>
          <button className="button button-secondary" disabled={!confirmed || Boolean(pending) || busy || quote.isFetching || data.cart.has_unavailable_items} onClick={() => pay('decline')}>Simulate failed payment</button>
          <button className="text-button" disabled={Boolean(pending) || payment.isPending || quote.isFetching} onClick={() => { setPrevious(data); setConfirmed(false); void quote.refetch() }}>Refresh prices and stock</button>
          <p>Successful simulation delivers nonredeemable demo keys to your account. A failed simulation keeps your cart and does not allocate keys.</p>
        </aside></div>}
    <p><Link to="/orders" className="text-link">Order history</Link></p>
  </div>
}

export function CheckoutPage() { usePageTitle('Checkout'); return <RequireAuth><CheckoutContent /></RequireAuth> }
