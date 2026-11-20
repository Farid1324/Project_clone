import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const password = crypto.randomUUID()

async function register(page: Page, returnTo = '/cart') {
  const email = 'buyer-' + crypto.randomUUID() + '@example.test'
  await page.goto('/register?' + new URLSearchParams({ returnTo }))
  await page.getByLabel('Name', { exact: true }).fill('Demo Buyer')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(returnTo + '$'))
  return email
}

async function addAvailableOffer(page: Page) {
  const catalog = (await (await page.request.get('/api/v1/products?type=game&per_page=48')).json()).data
  for (const candidate of catalog.filter((item: { slug: string }) => !item.slug.includes('stardew'))) {
    const product = (await (await page.request.get('/api/v1/products/' + candidate.slug)).json()).data
    const offer = product.offers.find((item: { stock_available: number }) => item.stock_available >= 5)
    if (!offer) continue
    await page.goto('/products/' + product.slug)
    await page.locator('[data-offer-id="' + offer.id + '"]').getByRole('button', { name: /^Add to cart from / }).click()
    await expect(page.locator('.offer-feedback[role="status"]')).toBeVisible()
    return { product, offer }
  }
  throw new Error('Seed demo inventory with an available non-Stardew game offer containing at least five keys.')
}

async function write(page: Page, path: string, data: object) {
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')
  return page.request.post(path, { data, headers: { 'X-XSRF-TOKEN': decodeURIComponent(token!.value), 'Sec-Fetch-Site': 'cross-site' } })
}

test.beforeAll(async ({ request }) => { expect((await request.get('/api/v1/health')).ok()).toBeTruthy() })

for (const width of [1440, 390]) {
  test(`guest cart merges through registration, purchase delivers keys, and history survives logout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const { product, offer } = await addAvailableOffer(page)
    await page.goto('/cart')
    await page.getByRole('link', { name: 'Sign in to checkout', exact: true }).click()
    await expect(page).toHaveURL(/\/login\?returnTo=/)
    await page.getByRole('link', { name: 'Create account', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Demo Buyer')
    const email = 'buyer-' + crypto.randomUUID() + '@example.test'
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Review your order', exact: true })).toBeVisible()
    await expect(page.locator('.checkout-item')).toContainText(offer.seller.name)
    await expect(page.locator('.checkout-item')).toContainText(product.region.name)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await expect(page.getByRole('button', { name: 'Simulate successful payment', exact: true })).toBeDisabled()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
    const orderUrl = page.url()
    const keys = await page.locator('.demo-key code').allTextContents()
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(/^DEMO-/)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.getByRole('link', { name: 'Your account', exact: true }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(url => url.pathname === '/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
    await page.goto(orderUrl)
    await expect(page.getByRole('heading', { name: 'Sign in to continue', exact: true })).toBeVisible()
    await expect(page.locator('.demo-key')).toHaveCount(0)
    await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(orderUrl)
    await expect(page.locator('.demo-key code')).toHaveText(keys)
    await page.getByRole('link', { name: 'Back to order history', exact: true }).click()
    await expect(page.locator('.order-history-card')).toHaveCount(1)
  })
}

test('failed simulated payment retains cart and a new attempt can succeed', async ({ page }) => {
  await register(page)
  await addAvailableOffer(page)
  await page.goto('/checkout')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate failed payment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Demo payment declined', exact: true })).toBeVisible()
  await expect(page.locator('.demo-key')).toHaveCount(0)
  expect((await (await page.request.get('/api/v1/cart')).json()).data.items_count).toBe(1)
  await page.getByRole('link', { name: 'Try another demo payment', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  await page.goto('/orders')
  await expect(page.locator('.order-history-card')).toHaveCount(2)
  expect((await (await page.request.get('/api/v1/cart')).json()).data.items_count).toBe(0)
})

test('duplicate HTTP purchase returns one order and another session cannot read its keys', async ({ page, browser }) => {
  await register(page)
  await addAvailableOffer(page)
  const quote = (await (await page.request.get('/api/v1/checkout/quote')).json()).data
  const data = { quote_token: quote.quote_token, scenario: 'approve', idempotency_key: crypto.randomUUID() }
  const first = await write(page, '/api/v1/checkout', data)
  expect(first.status()).toBe(201)
  const id = (await first.json()).data.id
  const duplicate = await write(page, '/api/v1/checkout', data)
  expect(duplicate.status()).toBe(200)
  expect((await duplicate.json()).data.id).toBe(id)
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(1)
  const context = await browser.newContext()
  try {
    const outsider = await context.newPage()
    await register(outsider)
    expect((await outsider.request.get('/api/v1/orders/' + id)).status()).toBe(404)
    expect((await (await outsider.request.get('/api/v1/orders')).json()).meta.total).toBe(0)
  } finally { await context.close() }
})

test('price and stock conflicts refresh the summary and require explicit confirmation again', async ({ page }) => {
  await register(page)
  await addAvailableOffer(page)
  await page.goto('/checkout')
  await expect(page.locator('.checkout-item')).toHaveCount(1)
  const quote = (await (await page.request.get('/api/v1/checkout/quote')).json()).data
  quote.cart.items[0].unit_price_minor += 100
  quote.cart.items[0].line_total_minor += 100
  quote.cart.items[0].stock_available -= 1
  quote.cart.total_minor += 100
  await page.route('**/api/v1/checkout/quote', route => route.fulfill({ json: { data: quote } }))
  await page.route('**/api/v1/checkout', route => route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'Price or stock changed. Review the updated order summary before paying again.' } } }))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Price or stock changes', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Simulate successful payment', exact: true })).toBeDisabled()
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(0)
})

test('an interrupted response recovers the original successful purchase after reload', async ({ page }) => {
  await register(page)
  await addAvailableOffer(page)
  const sent: object[] = []
  let interrupted = false
  await page.route('**/api/v1/checkout', async route => {
    sent.push(route.request().postDataJSON())
    if (!interrupted) {
      interrupted = true
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      await route.abort('failed')
    } else { await route.continue() }
  })
  await page.goto('/checkout')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payment result needs confirmation', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Check payment result', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  expect(sent).toHaveLength(2)
  expect(sent[0]).toEqual(sent[1])
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(1)
  await expect(page.locator('.demo-key code')).toHaveCount(1)
})

test('real HTTP registration enforces CSRF, rotates sessions, and logout revokes protected access', async ({ page, browser }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  const oldCookies = await page.context().cookies()
  const data = { name: 'HTTP Buyer', email: crypto.randomUUID() + '@example.test', password, password_confirmation: password }
  expect((await page.request.get('/api/v1/checkout/quote')).status()).toBe(401)
  expect((await page.request.post('/api/v1/auth/register', { data, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status()).toBe(419)
  expect((await write(page, '/api/v1/auth/login', { email: ['invalid@example.test'], password })).status()).toBe(422)
  expect((await write(page, '/api/v1/auth/register', { ...data, password: 'a demo\u0000password 2027', password_confirmation: 'a demo\u0000password 2027' })).status()).toBe(422)
  expect((await write(page, '/api/v1/auth/register', data)).status()).toBe(201)
  const after = await page.context().cookies()
  const session = after.find(cookie => cookie.httpOnly)!
  expect(Boolean(session.httpOnly && session.sameSite === 'Lax')).toBeTruthy()
  expect(session.value === oldCookies.find(cookie => cookie.name === session.name)!.value).toBeFalsy()
  const stale = await browser.newContext({ storageState: { cookies: oldCookies, origins: [] } })
  try { expect((await stale.request.get((process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173') + '/api/v1/orders')).status()).toBe(401) } finally { await stale.close() }
  expect((await write(page, '/api/v1/auth/logout', {})).status()).toBe(200)
  expect((await page.request.get('/api/v1/orders')).status()).toBe(401)
  const savedAuth = await browser.newContext({ storageState: { cookies: after, origins: [] } })
  try { expect((await savedAuth.request.get((process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173') + '/api/v1/orders')).status()).toBe(401) } finally { await savedAuth.close() }
})

test('a revoked server session clears cached identity before showing a protected page', async ({ page }) => {
  await register(page)
  await page.getByRole('link', { name: 'Your account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible()
  expect((await write(page, '/api/v1/auth/logout', {})).status()).toBe(200)
  await page.getByRole('link', { name: 'Order history', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue', exact: true })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.locator('.order-history-card,.demo-key')).toHaveCount(0)
})
