import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cart, Envelope } from '../types/api'
import { api, ApiError } from '../lib/api'

const cartKey = ['cart'] as const
export const useCart = () => useQuery({ queryKey: cartKey, queryFn: ({ signal }) => api.cart(signal), staleTime: 0 })
export const useCartBusy = () => useIsMutating({ predicate: mutation => ['cart', 'session', 'checkout'].includes(String(mutation.options.mutationKey?.[0])) }) > 0

function useCartMutation<T>(operation: (variables: T) => Promise<Envelope<Cart>>, productSlug?: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationKey: ['cart', 'write'],
    mutationFn: operation,
    retry: false,
    onMutate: () => cache.cancelQueries({ queryKey: cartKey }),
    onSuccess: response => { cache.setQueryData(cartKey, response); void cache.invalidateQueries({ queryKey: ['checkout'] }) },
    onError: error => {
      void cache.invalidateQueries({ queryKey: cartKey })
      if (productSlug && error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void cache.invalidateQueries({ queryKey: ['product', productSlug] })
      }
    },
  })
}

export const useAddToCart = (slug: string) => useCartMutation((offerId: string) => api.addCartItem(offerId), slug)
export const useUpdateCartItem = () => useCartMutation(({ id, quantity }: { id: string; quantity: number }) => api.updateCartItem(id, quantity))
export const useRemoveCartItem = () => useCartMutation((id: string) => api.removeCartItem(id))
export const cartErrorMessage = (error: Error) => error instanceof ApiError ? error.message : 'The update could not be confirmed. Refresh your cart before trying again.'
