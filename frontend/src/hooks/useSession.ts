import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCart } from './useCart'
import type { Envelope, Session } from '../types/api'

export function useSession() {
  const cart = useCart()
  return useQuery({ queryKey: ['session'], queryFn: ({ signal }) => api.session(signal), enabled: !cart.isPending, staleTime: 30_000, refetchOnWindowFocus: true, retry: false })
}

export function useSessionMutation<T>(operation: (input: T) => Promise<Envelope<Session>>) {
  const cache = useQueryClient()
  return useMutation({
    mutationKey: ['session', 'write'], mutationFn: operation, retry: false,
    onMutate: async () => { await cache.cancelQueries() },
    onSuccess: async response => {
      cache.removeQueries({ predicate: query => ['order', 'orders', 'checkout'].includes(String(query.queryKey[0])) })
      cache.setQueryData(['session'], response)
      cache.setQueryData(['cart'], { data: { id: null, version: 0, currency: 'EUR', items: [], items_count: 0, total_minor: 0, has_unavailable_items: false, limits: { quantity_per_offer: 9, distinct_offers: 20 } } })
      await cache.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
