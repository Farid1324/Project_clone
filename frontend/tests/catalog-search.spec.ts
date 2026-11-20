import { expect, test } from '@playwright/test'

async function catalogIds(page: import('@playwright/test').Page) {
  return page.locator('.product-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-product-id')))
}

test.beforeAll(async ({ request }) => {
  expect((await request.get('/api/v1/health')).ok(), 'Start the seeded PostgreSQL/Laravel backend on port 8000.').toBeTruthy()
})

test('combined URL filters restore inputs, matching rows and page size through reload and Back', async ({ page, request }) => {
  const query = new URLSearchParams({ q: 'stardew', 'platforms[]': 'steam', 'regions[]': 'US', 'categories[]': 'indie', price_min: '1000', price_max: '1500', sort: 'price_asc', per_page: '1' })
  const expected = (await (await request.get('/api/v1/products?' + query)).json()).data
  expect(expected).toHaveLength(1)
  await page.goto('/store?' + query)
  await expect(page.getByRole('checkbox', { name: 'Steam', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'US', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Indie', exact: true })).toBeChecked()
  await expect(page.getByLabel('Min €', { exact: true })).toHaveValue('10')
  await expect(page.getByLabel('Max €', { exact: true })).toHaveValue('15')
  await expect(page.getByLabel('Sort products')).toHaveValue('price_asc')
  await expect.poll(() => catalogIds(page)).toEqual(expected.map((product: { id: string }) => product.id))
  await page.getByRole('button', { name: 'Remove US filter', exact: true }).click()
  expect(new URL(page.url()).searchParams.has('regions[]')).toBeFalsy()
  await expect(page.getByRole('checkbox', { name: 'US', exact: true })).not.toBeChecked()
  await expect(page.locator('.product-card')).toHaveCount(1)
  const first = await catalogIds(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('page')).toBe('2')
  await expect.poll(() => catalogIds(page)).not.toEqual(first)
  await page.goBack()
  await expect.poll(() => catalogIds(page)).toEqual(first)
  await page.goBack()
  await expect(page.getByRole('checkbox', { name: 'US', exact: true })).toBeChecked()
  await expect.poll(() => catalogIds(page)).toEqual(expected.map((product: { id: string }) => product.id))
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'US', exact: true })).toBeChecked()
  await expect(page.getByLabel('Min €', { exact: true })).toHaveValue('10')
  await expect(page.getByLabel('Max €', { exact: true })).toHaveValue('15')
  await expect.poll(() => catalogIds(page)).toEqual(expected.map((product: { id: string }) => product.id))
})

test('popularity pagination displays the corresponding backend-ranked products and resets on sort changes', async ({ page, request }) => {
  const first = (await (await request.get('/api/v1/products?sort=popularity&per_page=2')).json()).data
  const second = (await (await request.get('/api/v1/products?sort=popularity&per_page=2&page=2')).json()).data
  await page.goto('/store?sort=popularity&per_page=2')
  await expect(page.getByLabel('Sort products')).toHaveValue('popularity')
  await expect.poll(() => catalogIds(page)).toEqual(first.map((product: { id: string }) => product.id))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => catalogIds(page)).toEqual(second.map((product: { id: string }) => product.id))
  await page.goBack()
  await expect.poll(() => catalogIds(page)).toEqual(first.map((product: { id: string }) => product.id))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Sort products').selectOption('newest')
  expect(new URL(page.url()).searchParams.has('page')).toBeFalsy()
  expect(new URL(page.url()).searchParams.get('per_page')).toBe('2')
})

test('price directions and newest render the exact database order', async ({ page, request }) => {
  await page.goto('/store?per_page=4')
  for (const sort of ['price_asc', 'price_desc', 'newest']) {
    const expected = (await (await request.get('/api/v1/products?sort=' + sort + '&per_page=4')).json()).data
    await page.getByLabel('Sort products').selectOption(sort)
    expect(new URL(page.url()).searchParams.get('sort')).toBe(sort)
    await expect.poll(() => catalogIds(page)).toEqual(expected.map((product: { id: string }) => product.id))
  }
})

test('applying a facet resets the page while preserving search, sorting and price bounds', async ({ page }) => {
  await page.goto('/store?sort=price_asc&price_min=100&price_max=10000&per_page=2&page=2')
  await expect(page.locator('.product-card')).toHaveCount(2)
  await page.getByRole('checkbox', { name: 'Steam', exact: true }).check()
  const query = new URL(page.url()).searchParams
  expect(query.has('page')).toBeFalsy()
  expect(query.get('sort')).toBe('price_asc')
  expect(query.get('price_min')).toBe('100')
  expect(query.get('price_max')).toBe('10000')
  expect(query.getAll('platforms[]')).toEqual(['steam'])
})

test('rapid typing debounces autocomplete into one database request', async ({ page }) => {
  const terms: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/search/suggestions') terms.push(url.searchParams.get('q') ?? '')
  })
  await page.goto('/about')
  const input = page.getByRole('combobox', { name: 'Search games and gift cards' })
  await input.pressSequentially('minecraf', { delay: 30 })
  await expect(page.getByRole('option').first()).toBeVisible()
  expect(terms).toEqual(['minecraf'])
  await input.press('Escape')
  await expect(page.getByRole('listbox', { name: 'Search suggestions' })).toHaveCount(0)
})

for (const width of [1440, 390]) {
  for (const route of ['/', '/store', '/about', '/products', '/does-not-exist']) {
    test(`global case-insensitive typo search works from ${route} at ${width}px`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      const expectedResponse = await request.get('/api/v1/search/suggestions?q=MINCRAFT')
      const expected = (await expectedResponse.json()).data[0]
      expect(expected.title).toContain('Minecraft')
      let target = route
      if (route === '/products') {
        const products = (await (await request.get('/api/v1/products?per_page=1')).json()).data
        target = '/products/' + products[0].slug
      }
      await page.goto(target)
      if (width === 390) await page.getByRole('button', { name: 'Open search', exact: true }).click()
      const input = page.getByRole('combobox', { name: 'Search games and gift cards' })
      await input.fill('MINCRAFT')
      await expect(page.getByRole('option').first()).toContainText(expected.title)
      await input.press('ArrowDown')
      await input.press('Enter')
      await expect(page).toHaveURL(new RegExp('/products/' + expected.slug + '$'))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.title)
      await expect(page.locator('.seller-offer')).toHaveCount(3)
    })
  }
}

test('out-of-range pages recover without losing the current search and filters', async ({ page }) => {
  await page.goto('/store?q=elden&platforms%5B%5D=steam&sort=popularity&per_page=2&page=99')
  await expect(page.getByRole('heading', { name: 'No products on this page', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Go to first page', exact: true }).click()
  const query = new URL(page.url()).searchParams
  expect(query.get('page')).toBe('1')
  expect(query.get('q')).toBe('elden')
  expect(query.getAll('platforms[]')).toEqual(['steam'])
  expect(query.get('sort')).toBe('popularity')
  await expect(page.locator('.product-card')).toHaveCount(1)
})
