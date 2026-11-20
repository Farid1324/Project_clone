import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export const useFilters = () => useQuery({ queryKey: ['catalog-filters'], queryFn: ({ signal }) => api.filters(signal), staleTime: 300_000 })
export const useBanners = () => useQuery({ queryKey: ['home-banners'], queryFn: ({ signal }) => api.banners(signal) })
export const usePopularCategories = () => useQuery({ queryKey: ['home-categories'], queryFn: ({ signal }) => api.popularCategories(signal) })
export const useBestSellers = () => useQuery({ queryKey: ['home-best-sellers'], queryFn: ({ signal }) => api.bestSellers(signal) })
export const useDeals = () => useQuery({ queryKey: ['home-deals'], queryFn: ({ signal }) => api.deals(signal) })
export const useGiftCards = () => useQuery({ queryKey: ['home-gift-cards'], queryFn: ({ signal }) => api.giftCards(signal) })
export const useRecommendations = () => useQuery({ queryKey: ['home-recommendations'], queryFn: ({ signal }) => api.recommendations(signal) })
export const usePromotions = () => useQuery({ queryKey: ['home-promotions'], queryFn: ({ signal }) => api.promotions(signal) })
export const useProducts = (query: string) => useQuery({ queryKey: ['products', query], queryFn: ({ signal }) => api.products(query, signal) })
export const useProduct = (slug: string) => useQuery({ queryKey: ['product', slug], queryFn: ({ signal }) => api.product(slug, signal) })
