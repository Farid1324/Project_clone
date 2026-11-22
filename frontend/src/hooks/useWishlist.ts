import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from './useSession'
import { api } from '../lib/api'
import type { Envelope, Session } from '../types/api'

export function useWishlistSummary() {
  const session = useSession()
  const userId = session.data?.data.user?.id
  const summary = useQuery({
    queryKey: ['wishlist', userId, 'summary'],
    queryFn: ({ signal }) => api.wishlistSummary(signal),
    enabled: session.isSuccess && Boolean(userId),
    meta: { userId }, staleTime: 0, retry: false,
  })
  return { session, userId, summary }
}

export function useWishlistProducts(userId: string | undefined, page: number) {
  return useQuery({ queryKey: ['wishlist', userId, 'products', page], queryFn: ({ signal }) => api.wishlist(page, signal),
    enabled: Boolean(userId), meta: { userId }, staleTime: 0, retry: false })
}

export function useWishlistBusy(userId: string | undefined) {
  return useIsMutating({ predicate: mutation => mutation.options.mutationKey?.[0] === 'session'
    || (mutation.options.mutationKey?.[0] === 'wishlist' && mutation.options.mutationKey[1] === userId) }) > 0
}

export function useWishlistMutation(userId: string | undefined) {
  const cache = useQueryClient()
  const ownsCurrentSession = () => Boolean(userId) && cache.getQueryData<Envelope<Session>>(['session'])?.data.user?.id === userId
  return useMutation({
    mutationKey: ['wishlist', userId, 'write'], meta: { userId }, retry: false,
    mutationFn: ({ productId, saved }: { productId: string; saved: boolean }) => saved ? api.removeWishlistProduct(productId) : api.saveWishlistProduct(productId),
    onMutate: () => cache.cancelQueries({ queryKey: ['wishlist', userId] }),
    onSuccess: async response => {
      if (!ownsCurrentSession()) return
      cache.setQueryData(['wishlist', userId, 'summary'], response)
      await cache.invalidateQueries({ queryKey: ['wishlist', userId, 'products'] })
    },
    onError: error => {
      if (error.name === 'AbortError') return
      if (ownsCurrentSession()) void cache.invalidateQueries({ queryKey: ['wishlist', userId] })
    },
  })
}
