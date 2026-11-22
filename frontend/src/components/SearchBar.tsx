import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatMoney, storeUrl } from '../lib/format'
import { MarketplaceImage } from './MarketplaceImage'

export function SearchBar({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const [params] = useSearchParams()
  const routeTerm = params.get('q') ?? ''
  return <SearchInput key={routeTerm} initialTerm={routeTerm} autoFocus={autoFocus} onNavigate={onNavigate} />
}

function SearchInput({ initialTerm, autoFocus, onNavigate }: { initialTerm: string; autoFocus: boolean; onNavigate?: () => void }) {
  const [term, setTerm] = useState(initialTerm)
  const [debounced, setDebounced] = useState(term)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const id = useId()
  const listId = id + '-suggestions'
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(term.trim()); setActive(-1) }, 250)
    return () => clearTimeout(timer)
  }, [term])
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  const query = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: ({ signal }) => api.suggestions(debounced, signal),
    enabled: focused && debounced.length >= 2,
    staleTime: 30_000,
  })
  const ready = term.trim() === debounced
  const results = ready && !query.isFetching ? query.data?.data ?? [] : []
  const expanded = focused && term.trim().length >= 2
  const loading = !ready || query.isFetching
  function go(path: string) {
    setFocused(false)
    setActive(-1)
    navigate(path)
    onNavigate?.()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    go(storeUrl({ q: term.trim() }))
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setFocused(false); setActive(-1) }
    if (event.key === 'ArrowDown') {
      event.preventDefault(); setFocused(true); setActive(index => Math.min(index + 1, results.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault(); setActive(index => Math.max(index - 1, 0))
    }
    if (event.key === 'Enter' && expanded && active >= 0 && results[active]) {
      event.preventDefault(); go('/products/' + results[active].slug)
    }
  }
  return <form className="search" role="search" onSubmit={submit} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
  }}>
    <div className="search-field">
      <button className="icon-button search-submit" type="submit" aria-label="Search catalog"><Search size={24} aria-hidden="true" /></button>
      <label className="sr-only" htmlFor={id}>Search games and gift cards</label>
      <input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded && !loading && results.length > 0}
        aria-controls={expanded && results.length > 0 ? listId : undefined}
        aria-activedescendant={expanded && results[active] ? listId + '-' + active : undefined}
        autoComplete="off" maxLength={100} placeholder="Search for games, gift cards and more" value={term}
        onChange={event => { setTerm(event.target.value); setFocused(true); setActive(-1) }}
        onFocus={() => setFocused(true)} onKeyDown={keyboard} />
      {term && <button type="button" className="icon-button search-clear" aria-label="Clear search" onClick={() => {
        setTerm(''); setActive(-1); input.current?.focus()
      }}><X size={18} aria-hidden="true" /></button>}
    </div>
    {expanded && <div className="search-dropdown">
      {loading ? <p className="search-notice" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" />Searching the marketplace…</p>
        : query.isError ? <p className="search-notice" role="alert">Suggestions are unavailable. Press Enter to search the store.</p>
          : results.length === 0 ? <p className="search-notice" role="status">No matching products. Try a different title.</p>
            : <ul id={listId} role="listbox" aria-label="Search suggestions">
              {results.map((product, index) => <li key={product.id} id={listId + '-' + index} role="option" aria-selected={index === active}
                className={index === active ? 'is-active' : ''} onPointerMove={() => setActive(index)}
                onMouseDown={event => event.preventDefault()} onClick={() => go('/products/' + product.slug)}>
                <MarketplaceImage src={product.cover_image_url} alt="" width={36} height={54} />
                <span className="suggestion-title"><strong>{product.title}</strong><small>{product.platform.name} · {product.region.name}</small></span>
                <strong className="suggestion-price">{product.price_minor === null ? 'Unavailable' : formatMoney(product.price_minor)}</strong>
              </li>)}
            </ul>}
      {!loading && results.length > 0 && <button type="submit" className="search-all">View all results for “{term.trim()}”</button>}
    </div>}
  </form>
}
