import { useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFilters, useProducts } from '../hooks/useCatalog'
import { ProductGrid } from '../components/ProductGrid'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AsyncState } from '../components/AsyncState'
import { FilterPanel } from '../components/FilterPanel'
import { Dialog } from '../components/Dialog'
import { usePageTitle } from '../hooks/usePageTitle'

export function StorePage() {
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const facets = useFilters()
  const request = new URLSearchParams(params)
  if (!request.has('per_page')) request.set('per_page', '20')
  const products = useProducts(request.toString())
  const term = params.get('q')
  const title = term ? 'Results for “' + term + '”' : params.get('type') === 'gift_card' ? 'Gift cards' : 'Explore the catalog'
  usePageTitle(title)
  const sort = params.get('sort') ?? (term ? 'relevance' : 'newest')
  const selectionCount = ['categories[]', 'platforms[]', 'regions[]', 'price_min', 'price_max', 'in_stock', 'promotion'].reduce((sum, key) => sum + params.getAll(key).length, 0)
  function edit(change: (next: URLSearchParams) => void) {
    setParams(current => { const next = new URLSearchParams(current); change(next); next.delete('page'); return next }, { flushSync: true })
  }
  function page(number: number) {
    setParams(current => { const next = new URLSearchParams(current); next.set('page', String(number)); return next }, { flushSync: true })
    document.getElementById('catalog-heading')?.focus()
  }
  const filterPanel = facets.data ? <FilterPanel filters={facets.data.data} params={params} onChange={edit} /> : null
  const activeChips = [
    ...(facets.data?.data.categories ?? []).filter(item => params.getAll('categories[]').includes(item.slug)).map(item => ({ key: 'categories[]', value: item.slug, label: item.name })),
    ...(facets.data?.data.platforms ?? []).filter(item => params.getAll('platforms[]').includes(item.slug)).map(item => ({ key: 'platforms[]', value: item.slug, label: item.name })),
    ...(facets.data?.data.regions ?? []).filter(item => params.getAll('regions[]').includes(item.code)).map(item => ({ key: 'regions[]', value: item.code, label: item.name })),
  ]
  return <div className="market-container store-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>Catalog</span></nav>
    <div className="catalog-title"><div><p className="eyebrow">FIND YOUR NEXT FAVORITE</p><h1 id="catalog-heading" tabIndex={-1}>{title}</h1></div>
      {term && <button type="button" className="text-button clear-query" onClick={() => edit(next => next.delete('q'))}><X size={16} aria-hidden="true" />Clear search</button>}</div>
    <div className="store-layout">
      <aside className="desktop-filters" aria-label="Product filters">{facets.isPending ? <LoadingSkeleton variant="line" count={6} />
        : facets.isError ? <AsyncState compact title="Filters are unavailable" message="You can still browse products." onRetry={() => void facets.refetch()} /> : filterPanel}</aside>
      <div className="catalog-results">
        <div className="catalog-toolbar"><div className="results-summary" role="status" aria-live="polite">{products.data ? <><strong>{products.data.meta.total}</strong> products</> : 'Finding products…'}</div>
          <div className="catalog-controls"><button type="button" className="button button-secondary mobile-filter-button" onClick={() => setFiltersOpen(true)} aria-label="Open filters"><SlidersHorizontal size={17} aria-hidden="true" />Filters{selectionCount > 0 && <span>({selectionCount})</span>}</button>
            <label className="sort-control"><span>Sort by</span><span className="select-wrap"><select aria-label="Sort products" value={sort} onChange={event => edit(next => next.set('sort', event.target.value))}>
              <option value="relevance">Relevance</option><option value="popularity">Popularity</option><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="title_asc">Name: A to Z</option>
            </select><ChevronDown size={16} aria-hidden="true" /></span></label>
          </div>
        </div>
        {(activeChips.length > 0 || params.get('promotion')) && <div className="active-filters" aria-label="Applied filters">
          {activeChips.map(chip => <button key={chip.key + chip.value} type="button" className="filter-chip" aria-label={'Remove ' + chip.label + ' filter'} onClick={() => edit(next => {
            const values = next.getAll(chip.key).filter(value => value !== chip.value); next.delete(chip.key); values.forEach(value => next.append(chip.key, value))
          })}>{chip.label}<X size={14} aria-hidden="true" /></button>)}
          {params.get('promotion') && <button type="button" className="filter-chip" onClick={() => edit(next => next.delete('promotion'))}>Collection<X size={14} aria-hidden="true" /></button>}
        </div>}
        {products.isPending ? <LoadingSkeleton count={8} /> : products.isError ? <AsyncState title="Products could not load" message={products.error.message + ' You can also reset the URL filters.'} onRetry={() => void products.refetch()} />
          : !products.data.data.length ? <div className="empty-results"><AsyncState title={products.data.meta.current_page > 1 ? 'No products on this page' : 'No products found'} message={products.data.meta.current_page > 1 ? 'Return to the first page while keeping your search and filters.' : 'Try a different search or adjust your filters.'} />
            {products.data.meta.current_page > 1 ? <button type="button" className="button button-primary" onClick={() => page(1)}>Go to first page</button>
              : <button type="button" className="button button-primary" onClick={() => setParams({})}>Reset all filters</button>}</div>
            : <ProductGrid products={products.data.data} label="Catalog products" compact />}
        {products.isError && <button type="button" className="text-button reset-error" onClick={() => setParams({})}>Reset all filters</button>}
        {products.data && products.data.meta.last_page > 1 && <nav className="pagination" aria-label="Catalog pages">
          <button className="button button-secondary" type="button" disabled={products.data.meta.current_page <= 1} onClick={() => page(products.data.meta.current_page - 1)}>Previous</button>
          {Array.from({ length: products.data.meta.last_page }, (_, index) => index + 1).filter(number => Math.abs(number - products.data.meta.current_page) <= 2).map(number =>
            <button key={number} type="button" className="page-number" aria-label={'Go to page ' + number} aria-current={number === products.data.meta.current_page ? 'page' : undefined} onClick={() => page(number)}>{number}</button>)}
          <button className="button button-secondary" type="button" disabled={products.data.meta.current_page >= products.data.meta.last_page} onClick={() => page(products.data.meta.current_page + 1)}>Next</button>
        </nav>}
      </div>
    </div>
    <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Product filters">
      {filterPanel ?? (facets.isError ? <AsyncState title="Filters could not load" message="Please try again." onRetry={() => void facets.refetch()} /> : <LoadingSkeleton variant="line" count={5} />)}
      <button type="button" className="button button-primary drawer-done" onClick={() => setFiltersOpen(false)}>Show results</button>
    </Dialog>
  </div>
}
