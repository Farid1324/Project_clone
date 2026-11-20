interface Props { variant?: 'card' | 'hero' | 'line'; count?: number; recommended?: boolean }
export function LoadingSkeleton({ variant = 'card', count = 1, recommended = false }: Props) {
  return <div role="status" aria-label="Loading marketplace content" className={variant === 'card' ? 'product-grid' + (recommended ? ' product-grid-recommended' : '') : ''}>
    <span className="sr-only">Loading…</span>
    {Array.from({ length: count }, (_, index) => <div key={index} aria-hidden="true" className={'skeleton skeleton-' + variant}>
      {variant === 'card' && <><div className="skeleton-cover" /><div className="skeleton-copy"><i /><i /><i /></div></>}
    </div>)}
  </div>
}
