import type { Product } from '../types/api'
import { ProductCard } from './ProductCard'

export function ProductGrid({ products, label, compact = false, recommended = false }: { products: Product[]; label: string; compact?: boolean; recommended?: boolean }) {
  return <ul className={'product-grid' + (compact ? ' product-grid-catalog' : '') + (recommended ? ' product-grid-recommended' : '')} aria-label={label}>
    {products.map(product => <li key={product.id}><ProductCard product={product} /></li>)}
  </ul>
}
