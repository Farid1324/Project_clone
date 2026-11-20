import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CatalogFilters } from '../types/api'

interface Props {
  filters: CatalogFilters
  params: URLSearchParams
  onChange: (edit: (next: URLSearchParams) => void) => void
}
export function FilterPanel({ filters, params, onChange }: Props) {
  const id = useId()
  const priceForm = useRef<HTMLFormElement>(null)
  const minPrice = params.get('price_min'), maxPrice = params.get('price_max')
  useEffect(() => { priceForm.current?.reset() }, [minPrice, maxPrice])
  const [priceError, setPriceError] = useState('')
  function toggle(key: string, value: string) {
    onChange(next => {
      const values = next.getAll(key)
      next.delete(key)
      for (const item of values.includes(value) ? values.filter(item => item !== value) : [...values, value]) next.append(key, item)
    })
  }
  function price(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const min = String(data.get('min') ?? ''), max = String(data.get('max') ?? '')
    if (min !== '' && max !== '' && Number(min) > Number(max)) { setPriceError('Minimum price must not exceed maximum price.'); return }
    setPriceError('')
    onChange(next => {
      for (const [key, value] of [['price_min', min], ['price_max', max]]) {
        if (value === '') next.delete(key)
        else next.set(key, String(Math.round(Number(value) * 100)))
      }
    })
  }
  return <div className="filter-panel">
    <div className="filter-heading"><h2>Filters</h2><button type="button" className="text-button" onClick={() => {
      setPriceError(''); onChange(next => { for (const key of ['categories[]', 'platforms[]', 'regions[]', 'price_min', 'price_max', 'in_stock', 'promotion']) next.delete(key) })
    }}>Reset</button></div>
    <fieldset><legend>Categories</legend>{filters.categories.map(category => <label className="check-label" key={category.id}>
      <input type="checkbox" checked={params.getAll('categories[]').includes(category.slug)} onChange={() => toggle('categories[]', category.slug)} />{category.name}
    </label>)}</fieldset>
    <fieldset><legend>Platform</legend>{filters.platforms.map(platform => <label className="check-label" key={platform.id}>
      <input type="checkbox" checked={params.getAll('platforms[]').includes(platform.slug)} onChange={() => toggle('platforms[]', platform.slug)} />{platform.name}
    </label>)}</fieldset>
    <fieldset><legend>Activation region</legend>{filters.regions.map(region => <label className="check-label" key={region.id}>
      <input type="checkbox" checked={params.getAll('regions[]').includes(region.code)} onChange={() => toggle('regions[]', region.code)} />{region.name}
    </label>)}</fieldset>
    <form ref={priceForm} className="price-filter" onSubmit={price}>
      <fieldset><legend>Price in EUR</legend><div className="price-inputs">
        <label htmlFor={id + '-min'}>Min €<input id={id + '-min'} name="min" type="number" min="0" step="0.01" max="21474836.47" defaultValue={params.has('price_min') ? Number(params.get('price_min')) / 100 : ''} /></label>
        <label htmlFor={id + '-max'}>Max €<input id={id + '-max'} name="max" type="number" min="0" step="0.01" max="21474836.47" defaultValue={params.has('price_max') ? Number(params.get('price_max')) / 100 : ''} /></label>
      </div>{priceError && <p role="alert" className="field-error">{priceError}</p>}<button className="button button-secondary price-apply" type="submit">Apply price</button></fieldset>
    </form>
    <fieldset><legend>Availability</legend><label className="check-label"><input type="checkbox" checked={params.get('in_stock') === 'false'}
      onChange={event => onChange(next => { if (event.target.checked) next.set('in_stock', 'false'); else next.delete('in_stock') })} />Include sold-out products</label></fieldset>
  </div>
}
