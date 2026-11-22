import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Product } from '../src/types/api'

async function register(page: Page) {
  const account = { email: 'wishlist-' + crypto.randomUUID() + '@example.test', password: crypto.randomUUID() }
  await page.goto('/register?returnTo=/wishlist')
  await page.getByLabel('Name', { exact: true }).fill('Wishlist Shopper')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByLabel('Confirm password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await expect(page).toHaveURL(/\/wishlist$/)
  await expect(page.getByRole('heading', { name: 'Your wishlist', exact: true })).toBeVisible()
  return account
}

async function logout(page: Page) {
  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
}

async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login?returnTo=/wishlist')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/wishlist$/)
}

async function product(page: Page, offset = 0): Promise<Product> {
  return (await (await page.request.get('/api/v1/products?per_page=48')).json()).data[offset]
}

const card = (page: Page, item: Product) => page.locator('.product-card[data-product-id="' + item.id + '"]').first()
const count = (page: Page, total: number) => expect(page.getByRole('banner').getByRole('link', { name: 'Wishlist, ' + total + (total === 1 ? ' saved product' : ' saved products'), exact: true })).toBeVisible()
const csrf = async (page: Page) => decodeURIComponent((await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')!.value)

for (const width of [1440, 768, 390, 320]) {
  test(`saving with the keyboard persists across pages, reload and login at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const account = await register(page)
    await count(page, 0)
    await page.goto('/store')
    const item = await product(page)
    const target = card(page, item)
    const heart = target.getByRole('button', { name: /^Save .* to wishlist$/ })
    await expect(heart).toBeEnabled()
    expect(await target.locator('a button').count()).toBe(0)
    await target.locator('.product-card-link').focus()
    await page.keyboard.press('Tab')
    await expect(heart).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/\/store$/)
    await expect(target.getByRole('button', { name: /^Remove .* from wishlist$/ })).toHaveAttribute('aria-pressed', 'true')
    await count(page, 1)
    await page.goto('/')
    await expect(page.locator('.product-card').first()).toBeVisible()
    const homeItem = page.locator('.product-card[data-product-id="' + item.id + '"]').first()
    if (await homeItem.count()) await expect(homeItem.locator('.wishlist-button')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('banner').getByRole('link', { name: 'Wishlist, 1 saved product', exact: true }).click()
    await expect(card(page, item)).toBeVisible()
    await page.reload()
    await expect(card(page, item)).toBeVisible()
    await count(page, 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    if (width === 1440 || width === 390) {
      await page.locator('.product-card img').first().evaluate((image: HTMLImageElement) => image.decode())
      await page.screenshot({ path: '../docs/ui-screenshots/keymarket-wishlist-' + width + '.png', fullPage: true })
    }
    await card(page, item).locator('.product-card-link').click()
    await expect(page).toHaveURL('/products/' + item.slug)
    await expect(page.locator('.detail-copy .wishlist-button')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.seller-offer')).not.toHaveCount(0)
    await logout(page)
    await login(page, account)
    await expect(card(page, item)).toBeVisible()
    await card(page, item).getByRole('button', { name: /^Remove .* from wishlist$/ }).click()
    await count(page, 0)
    await expect(page.getByRole('heading', { name: 'Your wishlist is ready for its first game' })).toBeVisible()
    await page.reload()
    await count(page, 0)
    expect(errors).toEqual([])
  })
}

test('a guest heart preserves the exact product through registration and protected API requests require a session', async ({ page }) => {
  await page.goto('/wishlist')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  expect((await page.request.get('/api/v1/wishlist')).status()).toBe(401)
  await page.goto('/store')
  const item = await product(page)
  await card(page, item).getByRole('button', { name: /^Save .* to wishlist$/ }).click()
  await expect(page).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('returnTo') === '/wishlist?save=' + item.id)
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Guest Wishlist Shopper')
  await page.getByLabel('Email', { exact: true }).fill('guest-wishlist-' + crypto.randomUUID() + '@example.test')
  const password = crypto.randomUUID()
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await expect(page).toHaveURL(/\/wishlist$/)
  await expect(card(page, item)).toBeVisible()
  await count(page, 1)
  await page.goto('/products/' + item.slug)
  await page.locator('.detail-copy').getByRole('button', { name: /^Remove .* from wishlist$/ }).click()
  await count(page, 0)
  await page.locator('.detail-copy').getByRole('button', { name: /^Save .* to wishlist$/ }).click()
  await count(page, 1)
  const rejected = await page.request.post('/api/v1/wishlist', { headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://untrusted.example' }, data: { product_id: item.id } })
  expect(rejected.status()).toBe(419)
})

test('signing out and changing accounts never exposes the previous wishlist', async ({ page }) => {
  const alice = await register(page)
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  await page.locator('.detail-copy .wishlist-button').click()
  await count(page, 1)
  await logout(page)
  await register(page)
  await count(page, 0)
  await expect(page.locator('.product-card')).toHaveCount(0)
  const removed = await page.request.delete('/api/v1/wishlist/' + item.id, { headers: { 'X-XSRF-TOKEN': await csrf(page) } })
  expect((await removed.json()).data.count).toBe(0)
  await logout(page)
  await login(page, alice)
  await expect(card(page, item)).toBeVisible()
  await count(page, 1)
})

test('failed writes preserve saved state and count and can be retried', async ({ page }) => {
  await register(page)
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  await page.route('**/api/v1/wishlist', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Wishlist temporarily unavailable.' } }) }))
  await page.locator('.detail-copy .wishlist-button').click()
  await expect(page.locator('.detail-copy [role="alert"]')).toContainText('Wishlist temporarily unavailable.')
  await count(page, 0)
  await expect(page.locator('.detail-copy .wishlist-button')).toHaveAttribute('aria-pressed', 'false')
  await page.unroute('**/api/v1/wishlist')
  await page.locator('.detail-copy .wishlist-button').click()
  await count(page, 1)
  await page.goto('/wishlist')
  await page.route('**/api/v1/wishlist/' + item.id, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Removal could not complete.' } }) }))
  await card(page, item).locator('.wishlist-button').click()
  await expect(card(page, item).getByRole('alert')).toContainText('Removal could not complete.')
  await expect(card(page, item).locator('.wishlist-button')).toHaveAttribute('aria-pressed', 'true')
  await count(page, 1)
  await page.unroute('**/api/v1/wishlist/' + item.id)
  await card(page, item).locator('.wishlist-button').click()
  await count(page, 0)
  await expect(page.locator('.product-card')).toHaveCount(0)
})

test('list and summary loading failures have working retry states without pretending the list is empty', async ({ page }) => {
  await register(page)
  let release!: () => void
  let reached!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { reached = resolve })
  await page.route('**/api/v1/wishlist?*', async route => {
    reached()
    await held
    await route.fulfill({ response: await route.fetch() })
  })
  await page.reload()
  await ready
  await expect(page.getByLabel('Loading saved products', { exact: true })).toHaveAttribute('aria-busy', 'true')
  release()
  await expect(page.getByRole('heading', { name: 'Your wishlist is ready for its first game' })).toBeVisible()
  await page.unroute('**/api/v1/wishlist?*')
  await page.route('**/api/v1/wishlist?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Please reconnect.' } }) }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your wishlist could not load' })).toBeVisible()
  await page.unroute('**/api/v1/wishlist?*')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your wishlist is ready for its first game' })).toBeVisible()
  await page.route('**/api/v1/wishlist/summary', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Status unavailable.' } }) }))
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Wishlist, saved count unavailable', exact: true })).toBeVisible()
  await expect(page.locator('.detail-copy .wishlist-button')).not.toHaveAttribute('aria-pressed')
  await page.unroute('**/api/v1/wishlist/summary')
  await page.locator('.detail-copy').getByRole('button', { name: /^Retry wishlist status/ }).click()
  await count(page, 0)
  await expect(page.locator('.detail-copy .wishlist-button')).toHaveAttribute('aria-pressed', 'false')
})

test('homepage hearts save without navigation and synchronize matching cards and product details', async ({ page }) => {
  await register(page)
  await page.goto('/')
  const first = page.locator('.product-card').first()
  const id = await first.getAttribute('data-product-id')
  const link = await first.locator('.product-card-link').getAttribute('href')
  await first.getByRole('button', { name: /^Save .* to wishlist$/ }).click()
  await expect(page).toHaveURL(url => url.pathname === '/')
  await count(page, 1)
  await expect.poll(async () => page.locator('.product-card[data-product-id="' + id + '"] .wishlist-button').evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-pressed') === 'true'))).toBe(true)
  await first.locator('.product-card-link').click()
  await expect(page).toHaveURL(link!)
  await expect(page.locator('.detail-copy .wishlist-button')).toHaveAttribute('aria-pressed', 'true')
})

test('wishlist pagination retains the full header count and recovers from an empty page', async ({ page }) => {
  await register(page)
  const products: Product[] = (await (await page.request.get('/api/v1/products?per_page=48')).json()).data
  const token = await csrf(page)
  for (const item of products.slice(0, 25)) {
    expect((await page.request.post('/api/v1/wishlist', { headers: { 'X-XSRF-TOKEN': token }, data: { product_id: item.id } })).ok()).toBeTruthy()
  }
  await page.reload()
  await count(page, 25)
  await expect(page.locator('.product-card')).toHaveCount(24)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/\?page=2$/)
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.locator('.product-card .wishlist-button').click()
  await count(page, 24)
  await expect(page.getByRole('link', { name: 'First page', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'First page', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(24)
})

test('unavailable and unpublished saved products remain visible and removable', async ({ page }) => {
  await register(page)
  const item = await product(page)
  await page.request.post('/api/v1/wishlist', { headers: { 'X-XSRF-TOKEN': await csrf(page) }, data: { product_id: item.id } })
  await page.route('**/api/v1/wishlist?*', async route => {
    const response = await route.fetch()
    const body = await response.json()
    body.data = body.data.map((entry: Product) => ({ ...entry, price_minor: null, comparison_price_minor: null, discount_percent: null, is_available: false, is_published: false, available_offer_count: 0 }))
    await route.fulfill({ response, json: body })
  })
  await page.reload()
  await expect(card(page, item)).toContainText('Unavailable')
  await expect(card(page, item)).toContainText('This listing is no longer published.')
  await expect(card(page, item).locator('a')).toHaveCount(0)
  await count(page, 1)
  await card(page, item).getByRole('button', { name: /^Remove .* from wishlist$/ }).click()
  await count(page, 0)
  await expect(page.locator('.product-card')).toHaveCount(0)
})

test('auth changes cancel an in-flight wishlist write before another account signs in', async ({ page }) => {
  const alice = await register(page)
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  let release!: () => void
  let reached!: () => void
  let finished!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { reached = resolve })
  const routed = new Promise<void>(resolve => { finished = resolve })
  await page.route('**/api/v1/wishlist', async route => {
    const response = await route.fetch()
    reached()
    await held
    await route.fulfill({ response }).catch(() => undefined)
    finished()
  })
  await page.locator('.detail-copy .wishlist-button').click()
  await ready
  const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/v1/wishlist' && request.method() === 'POST')
  await page.getByRole('banner').getByRole('link', { name: 'Your account', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  expect((await aborted).failure()?.errorText).toMatch(/ABORTED|CANCELLED/i)
  await expect(page).toHaveURL(url => url.pathname === '/')
  // Soft navigation preserves the old mutation object while testing the new account.
  await page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Another Shopper')
  await page.getByLabel('Email', { exact: true }).fill('next-wishlist-' + crypto.randomUUID() + '@example.test')
  const password = crypto.randomUUID()
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await page.getByRole('banner').getByRole('link', { name: /^Wishlist, 0 saved products$/ }).click()
  release()
  await routed
  await count(page, 0)
  await expect(page.getByRole('heading', { name: 'Your wishlist is ready for its first game' })).toBeVisible()
  expect((await (await page.request.get('/api/v1/auth/session')).json()).data.user.email).not.toBe(alice.email)
  await page.unroute('**/api/v1/wishlist')
  await logout(page)
  await login(page, alice)
  await expect(card(page, item)).toBeVisible()
})

test('a server-revoked session clears private wishlist UI and login restores persistence', async ({ page }) => {
  const account = await register(page)
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  await page.locator('.detail-copy .wishlist-button').click()
  await count(page, 1)
  await page.getByRole('banner').getByRole('link', { name: /^Wishlist, 1 saved product$/ }).click()
  await expect(card(page, item)).toBeVisible()
  expect((await page.request.post('/api/v1/auth/logout', { headers: { 'X-XSRF-TOKEN': await csrf(page) } })).ok()).toBeTruthy()
  await card(page, item).getByRole('button', { name: /^Remove .* from wishlist$/ }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.locator('.product-card')).toHaveCount(0)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Wishlist, sign in to save products', exact: true })).toBeVisible()
  await login(page, account)
  await expect(card(page, item)).toBeVisible()
  await count(page, 1)
})

test('a failed logout reconciles an already-committed wishlist write after its response is cancelled', async ({ page }) => {
  const account = await register(page)
  const item = await product(page)
  await page.goto('/products/' + item.slug)
  let release!: () => void
  let reached!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { reached = resolve })
  await page.route('**/api/v1/wishlist', async route => {
    const response = await route.fetch()
    reached()
    await held
    await route.fulfill({ response }).catch(() => undefined)
  })
  await page.locator('.detail-copy .wishlist-button').click()
  await ready
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Sign-out unavailable. Please retry.' } }) }))
  await page.getByRole('banner').getByRole('link', { name: 'Your account', exact: true }).click()
  const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/v1/wishlist' && request.method() === 'POST')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await aborted
  release()
  await expect(page.getByRole('alert')).toContainText('Sign-out unavailable.')
  await count(page, 1)
  expect((await (await page.request.get('/api/v1/auth/session')).json()).data.user.email).toBe(account.email)
})
