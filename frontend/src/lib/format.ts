const euros = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
export const formatMoney = (minor: number) => euros.format(minor / 100)
export const formatCount = (count: number) => new Intl.NumberFormat('en-GB').format(count)
export function storeUrl(values: Record<string, string | string[]> = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item))
    else if (value) query.set(key, value)
  }
  return '/store' + (query.size ? '?' + query.toString() : '')
}
