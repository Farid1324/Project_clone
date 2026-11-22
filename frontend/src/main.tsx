import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import './index.css'
import App from './App'
import { ApiError } from './lib/api'
import { clearWishlistCache } from './lib/wishlistPrivacy'

function clearExpiredSession(error: Error, ownerId?: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return
  const currentSession = queryClient.getQueryData<{ data: { user: { id: string } | null } }>(['session'])
  if (typeof ownerId === 'string' && ownerId !== currentSession?.data.user?.id) return
  queryClient.setQueryData(['session'], { data: { user: null, cart_merge_notices: [] } })
  queryClient.removeQueries({ predicate: query => ['order', 'orders', 'checkout', 'cart'].includes(String(query.queryKey[0])) })
  clearWishlistCache(queryClient)
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
}

const queryClient: QueryClient = new QueryClient({ queryCache: new QueryCache({ onError: (error, query) => clearExpiredSession(error, query.meta?.userId) }), mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => clearExpiredSession(error, mutation.meta?.userId) }), defaultOptions: { queries: {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status >= 500),
} } })

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>)
