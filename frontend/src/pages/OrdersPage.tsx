import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AsyncState } from '../components/AsyncState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useSession } from '../hooks/useSession'
import { usePageTitle } from '../hooks/usePageTitle'
import { api } from '../lib/api'
import { formatMoney } from '../lib/format'

function History() {
  const session = useSession()
  const userId = session.data?.data.user?.id
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page') ?? 1)
  const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1
  const query = useQuery({ queryKey: ['orders', userId, page], queryFn: ({ signal }) => api.orders(page, signal), enabled: Boolean(userId), staleTime: 0, retry: false })
  if (!userId) return null
  return <div className="market-container orders-page"><p className="eyebrow">YOUR DEMO PURCHASES</p><h1>Order history</h1><p>Only your account can retrieve these orders and their demo keys.</p>
    {query.isPending ? <LoadingSkeleton variant="line" count={4} /> : query.isError ? <AsyncState title="Orders could not load" message={query.error.message} onRetry={() => void query.refetch()} /> : <>
      {query.data.data.length ? <div className="order-list">{query.data.data.map(order => <article className="order-history-card" key={order.id}><div><h2>Order {order.id.slice(-8)}</h2><p>{new Date(order.created_at).toLocaleString()}</p><p className={order.status === 'fulfilled' ? 'stock-label' : 'field-error'}>{order.status === 'fulfilled' ? 'Payment approved · Demo keys delivered' : 'Payment declined · No keys allocated'}</p><p>{order.items.map(item => item.product_title).join(', ')}</p></div><div><strong>{formatMoney(order.total_minor)}</strong><Link className="button button-secondary" to={'/orders/' + order.id}>{order.status === 'fulfilled' ? 'View order and keys' : 'View failed attempt'}</Link></div></article>)}</div> : <><AsyncState title="No orders on this page" message="Browse the catalog or return to the first page of your history." />{page > 1 && <Link className="button button-secondary" to="/orders">First page</Link>}</>}
      {query.data.meta.last_page > 1 && <nav className="pagination" aria-label="Order pages"><button className="button button-secondary" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="button button-secondary" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ page: String(page + 1) })}>Next</button></nav>}
    </>}
    <Link className="text-link" to="/store">Browse the catalog</Link>
  </div>
}

function Detail() {
  const { orderId = '' } = useParams()
  const session = useSession()
  const userId = session.data?.data.user?.id
  const query = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => api.order(orderId, signal), enabled: Boolean(userId), staleTime: 0, gcTime: 0, retry: false })
  const order = query.data?.data
  if (!userId) return null
  return <div className="market-container orders-page"><Link className="text-link" to="/orders">Back to order history</Link>
    {query.isPending ? <LoadingSkeleton variant="line" count={4} /> : query.isError ? <AsyncState title="Order unavailable" message={query.error.message} onRetry={() => void query.refetch()} /> : order && <>
      <p className="eyebrow">SIMULATED PAYMENT · {order.payment.status.toUpperCase()}</p><h1>{order.status === 'fulfilled' ? 'Your demo keys are ready' : 'Demo payment declined'}</h1><p>Order <span className="order-reference">{order.id}</span></p><p>{new Date(order.created_at).toLocaleString()} · Total {formatMoney(order.total_minor)}</p>
      {order.status === 'payment_failed' && <div role="status" className="checkout-notice"><p>No keys were allocated. Your cart was kept. Try another simulated payment when you are ready.</p><Link className="button button-primary" to="/checkout">Try another demo payment</Link></div>}
      {order.items.map(item => <article className="delivered-item" key={item.id}><h2>{item.product_title}</h2><p>{item.platform_name} · {item.region_name} · Seller: {item.seller_name}</p><p>{item.quantity} × {formatMoney(item.unit_price_minor)} = {formatMoney(item.line_total_minor)}</p>
        {item.keys && <div className="delivered-keys"><h3>Your nonredeemable demo {item.keys.length === 1 ? 'key' : 'keys'}</h3>{item.keys.map((key, index) => <div className="demo-key" key={key}><span>Key {index + 1}</span><code>{key}</code></div>)}<p>For assignment demonstration only. Do not attempt to redeem these strings.</p></div>}
      </article>)}
      {order.status === 'fulfilled' && <p>Your purchased demo keys remain available here when you sign in again. Never share real activation keys publicly.</p>}<Link className="button button-secondary" to="/store">Continue browsing</Link>
    </>}
  </div>
}

export function OrdersPage() { usePageTitle('Order history'); return <RequireAuth><History /></RequireAuth> }
export function OrderPage() { usePageTitle('Order details'); return <RequireAuth><Detail /></RequireAuth> }
