import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function seededProduct(request: import('@playwright/test').APIRequestContext) {
  const list = await request.get('/api/v1/products?type=game&per_page=1')
  expect(list.ok()).toBeTruthy()
  const product = (await list.json()).data[0]
  return (await (await request.get('/api/v1/products/' + product.slug)).json()).data
}

test.beforeAll(async ({ request }) => {
  expect((await request.get('/api/v1/health')).ok(), 'Start the migrated, seeded Laravel backend on port 8000.').toBeTruthy()
})

for (const width of [1440, 390]) {
  test(`specific seller selection persists in the cart at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const product = await seededProduct(request)
    const selected = product.offers.filter((offer: { is_available: boolean }) => offer.is_available).at(-1)
    expect(selected.price_minor).toBeGreaterThan(product.price_minor)
    await page.goto('/products/' + product.slug)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.title)
    await expect(page.locator('.detail-art img')).toHaveAttribute('src', product.cover_image_url)
    await expect(page.locator('.activation-notice')).toContainText(product.activation_notice)
    await expect(page.locator('.compatibility-notice')).toContainText(product.platform.name)
    await expect(page.getByRole('heading', { name: 'Digital delivery', exact: true })).toBeVisible()
    expect(['pc', 'activation']).toContain(product.requirements?.kind)
    const requirementsHeading = product.requirements.kind === 'pc' ? 'Windows system requirements' : 'Activation requirements'
    await expect(page.getByRole('heading', { name: requirementsHeading, exact: true })).toBeVisible()
    await expect(page.locator('.activation-steps li')).toHaveCount(3)
    expect(await page.locator('.seller-offer').evaluateAll(elements => elements.map(element => element.getAttribute('data-offer-id')))).toEqual(product.offers.map((offer: { id: string }) => offer.id))
    const card = page.locator('.seller-offer[data-offer-id="' + selected.id + '"]')
    const sent = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/cart/items')
    await card.getByRole('button', { name: 'Add to cart from ' + selected.seller.name, exact: true }).click()
    expect((await sent).postDataJSON()).toEqual({ offer_id: selected.id, quantity: 1 })
    await expect(card.getByRole('status')).toContainText('Added from ' + selected.seller.name)
    const cart = (await (await page.request.get('/api/v1/cart')).json()).data
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].offer_id).toBe(selected.id)
    expect(cart.items[0].seller.id).toBe(selected.seller.id)
    expect(cart.items[0].unit_price_minor).toBe(selected.price_minor)
    await card.getByRole('link', { name: 'View cart', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your cart')
    const line = page.locator('.cart-line[data-offer-id="' + selected.id + '"]')
    await expect(line).toContainText(selected.seller.name)
    await line.getByRole('button', { name: /^Increase quantity/ }).click()
    await expect(line.locator('.quantity-control > span')).toHaveText('2')
    await page.reload()
    await expect(page.locator('.cart-line').locator('.quantity-control > span')).toHaveText('2')
    expect((await (await page.request.get('/api/v1/cart')).json()).data.items[0].offer_id).toBe(selected.id)
    await page.locator('.cart-line').getByRole('button', { name: /^Remove / }).click()
    await expect(page.getByRole('heading', { name: 'Your cart is empty', exact: true })).toBeVisible()
  })
}

test('two sellers for one product stay distinct and quantity changes affect only the selected offer', async ({ page, request }) => {
  const product = await seededProduct(request)
  const offers = product.offers.filter((offer: { is_available: boolean }) => offer.is_available).slice(0, 2)
  await page.goto('/products/' + product.slug)
  for (const offer of offers) {
    const response = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/cart/items')
    await page.locator('.seller-offer[data-offer-id="' + offer.id + '"]').getByRole('button', { name: /^Add to cart from/ }).click()
    expect((await response).ok()).toBeTruthy()
  }
  await page.getByRole('link', { name: 'Cart, 2 items', exact: true }).click()
  await expect(page.locator('.cart-line')).toHaveCount(2)
  const first = page.locator('.cart-line[data-offer-id="' + offers[0].id + '"]')
  const second = page.locator('.cart-line[data-offer-id="' + offers[1].id + '"]')
  await first.getByRole('button', { name: /^Increase quantity/ }).click()
  await expect(first.locator('.quantity-control > span')).toHaveText('2')
  await expect(second.locator('.quantity-control > span')).toHaveText('1')
  await first.getByRole('button', { name: /^Decrease quantity/ }).click()
  await expect(first.locator('.quantity-control > span')).toHaveText('1')
  await first.getByRole('button', { name: /^Remove / }).click()
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(second).toBeVisible()
  expect((await (await page.request.get('/api/v1/cart')).json()).data.items[0].offer_id).toBe(offers[1].id)
})

test('sold-out offers, unavailable products and no-offer products have honest disabled states', async ({ page, request }) => {
  const original = await seededProduct(request)
  let mode = 'one'
  await page.route('**/api/v1/products/' + original.slug, route => {
    const offers = mode === 'empty' ? [] : original.offers.map((offer: { id: string }) => {
      const unavailable = mode === 'all' || offer.id === original.offers[0].id
      return { ...offer, ...(unavailable ? { is_available: false, stock_available: 0 } : {}) }
    })
    const available = offers.filter((offer: { is_available: boolean }) => offer.is_available)
    return route.fulfill({ json: { data: { ...original, offers, is_available: available.length > 0, available_offer_count: available.length, price_minor: available[0]?.price_minor ?? null } } })
  })
  await page.goto('/products/' + original.slug)
  await expect(page.locator('.seller-offer').first().getByRole('button', { name: /^Sold out from/ })).toBeDisabled()
  await expect(page.locator('.seller-offer').nth(1).getByRole('button', { name: /^Add to cart from/ })).toBeEnabled()
  mode = 'all'
  await page.reload()
  await expect(page.getByText('This product is currently unavailable. Sold-out offers cannot be added to your cart.', { exact: true })).toBeVisible()
  for (const button of await page.locator('.offer-add').all()) await expect(button).toBeDisabled()
  mode = 'empty'
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No seller offers are currently available', exact: true })).toBeVisible()
  await expect(page.locator('.offer-add')).toHaveCount(0)
})

test('a stock conflict shows a real error without retrying or inventing a cart addition', async ({ page, request }) => {
  const product = await seededProduct(request)
  let attempts = 0
  await page.route('**/api/v1/cart/items', route => {
    attempts++
    return route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'This seller offer just sold out. Refresh availability.' } } })
  })
  await page.goto('/products/' + product.slug)
  const card = page.locator('.seller-offer').first()
  await card.getByRole('button', { name: /^Add to cart from/ }).click()
  await expect(card.getByRole('alert')).toContainText('This seller offer just sold out.')
  await expect(card.getByText(/^Added from/)).toHaveCount(0)
  expect(attempts).toBe(1)
  expect((await (await page.request.get('/api/v1/cart')).json()).data.items_count).toBe(0)
})

test('real HTTP cart writes require CSRF protection and sessions cannot access another cart line', async ({ request, browser }) => {
  const product = await seededProduct(request)
  const offer = product.offers.find((offer: { is_available: boolean }) => offer.is_available)
  const catalogResponse = await request.get('/api/v1/products/' + product.slug)
  expect(catalogResponse.headers()['set-cookie']).toBeUndefined()
  await request.get('/api/v1/cart')
  const rejected = await request.post('/api/v1/cart/items', { headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://untrusted.example' }, data: { offer_id: offer.id, quantity: 1 } })
  expect(rejected.status()).toBe(419)
  expect((await (await request.get('/api/v1/cart')).json()).data.items_count).toBe(0)
  await request.get('/sanctum/csrf-cookie')
  const state = await request.storageState()
  expect(state.cookies.some(cookie => cookie.httpOnly)).toBeTruthy()
  const token = state.cookies.find(cookie => cookie.name === 'XSRF-TOKEN')!.value
  const added = await request.post('/api/v1/cart/items', { headers: { 'X-XSRF-TOKEN': decodeURIComponent(token) }, data: { offer_id: offer.id, quantity: 1 } })
  expect(added.ok()).toBeTruthy()
  const cart = (await added.json()).data
  const other = await browser.newContext()
  try {
    await other.request.get((process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173') + '/sanctum/csrf-cookie')
    const otherState = await other.storageState()
    const otherToken = otherState.cookies.find(cookie => cookie.name === 'XSRF-TOKEN')!.value
    const empty = await other.request.get((process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173') + '/api/v1/cart')
    expect((await empty.json()).data.items_count).toBe(0)
    const foreign = await other.request.delete((process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173') + '/api/v1/cart/items/' + cart.items[0].id, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(otherToken) } })
    expect(foreign.status()).toBe(404)
    expect((await (await request.get('/api/v1/cart')).json()).data.items_count).toBe(1)
  } finally {
    await other.close()
  }
  await request.delete('/api/v1/cart/items/' + cart.items[0].id, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(token) } })
})

for (const width of [1440, 390]) {
  test(`populated cart is accessible and fits the viewport at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 })
    const product = await seededProduct(request)
    await page.goto('/products/' + product.slug)
    const card = page.locator('.seller-offer').first()
    await card.getByRole('button', { name: /^Add to cart from/ }).click()
    await card.getByRole('link', { name: 'View cart', exact: true }).click()
    await expect(page.locator('.cart-line')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations).toEqual([])
  })
}
