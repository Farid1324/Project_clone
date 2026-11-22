import type { QueryClient } from '@tanstack/react-query'

export function clearWishlistCache(client: QueryClient) {
  client.removeQueries({ queryKey: ['wishlist'] })
  const mutations = client.getMutationCache()
  for (const mutation of mutations.getAll()) {
    if (mutation.options.mutationKey?.[0] === 'wishlist') mutations.remove(mutation)
  }
}
