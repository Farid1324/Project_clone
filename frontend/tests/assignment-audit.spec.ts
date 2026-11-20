import { expect, test, type Page } from '@playwright/test'

function observe(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname) })
  return errors
}

test('all seeded cover, banner and promotion image URLs are valid same-origin images', async ({ request, baseURL }) => {
  const products = (await (await request.get('/api/v1/products?per_page=48&in_stock=false')).json()).data
  const banners = (await (await request.get('/api/v1/home/banners')).json()).data
  const promotions = (await (await request.get('/api/v1/home/promotions')).json()).data
  expect(products.length).toBeGreaterThanOrEqual(40)
  if (baseURL!.startsWith('https:')) {
    const html = await request.get('/')
    expect(html.headers()['content-security-policy']).toContain("connect-src 'self'")
    expect(html.headers()['x-frame-options']).toBe('DENY')
    expect(html.headers()['x-powered-by']).toBeUndefined()
    expect(html.headers()['cache-control']).toContain('no-cache')
    const assets = [...(await html.text()).matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    expect(assets.length).toBeGreaterThanOrEqual(2)
    for (const asset of assets) {
      const response = await request.get(asset[1])
      expect(response.headers()['cache-control']).toContain('immutable')
      expect(response.headers()['content-type']).not.toContain('text/html')
    }
    expect((await request.get('/assets/audit-missing.js')).status()).toBe(404)
    expect([403, 404]).toContain((await request.get('/.env')).status())
  }
  const urls = new Set<string>([...products.map((item: { cover_image_url: string }) => item.cover_image_url), ...banners.map((item: { image_url: string }) => item.image_url), ...promotions.map((item: { image_url: string }) => item.image_url)])
  for (const url of urls) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin)
    const image = await request.get(url)
    expect(image.status(), url).toBe(200)
    expect(image.headers()['content-type']).toMatch(/^image\//)
    expect((await image.body()).byteLength).toBeGreaterThan(0)
  }
})

test('database search matches complete names, partial names, casing and common typos', async ({ request }) => {
  for (const [q, title] of [['Elden Ring', 'Elden Ring'], ['elden', 'Elden Ring'], ['ELDEN', 'Elden Ring'], ['eldn ring', 'Elden Ring'], ['minecraf', 'Minecraft']]) {
    const response = await request.get('/api/v1/products?' + new URLSearchParams({ q }))
    expect(response.ok()).toBeTruthy()
    const results = (await response.json()).data
    expect(results.some((item: { title: string }) => item.title.includes(title)), q).toBeTruthy()
  }
})

for (const width of [320, 390, 768, 1440]) {
  test(`all marketplace routes load with images, no console or HTTP errors and no page overflow at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors = observe(page)
    const product = (await (await request.get('/api/v1/products?per_page=1')).json()).data[0]
    for (const route of ['/', '/store', '/about', '/login', '/register', '/cart', '/checkout', '/orders', '/account', '/products/' + product.slug]) {
      const response = await page.goto(route)
      expect(response!.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (route === '/' || route === '/store') await expect(page.locator('.product-card').first()).toBeVisible()
      if (route === '/') {
        await expect(page.locator('#gift-cards .product-card').first()).toBeVisible()
        await expect(page.locator('#recommendations .product-card').first()).toBeVisible()
        await expect(page.locator('#popular-categories .category-link').first()).toBeVisible()
      }
      if (route.startsWith('/products/')) await expect(page.locator('.seller-offer').first()).toBeVisible()
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 25)) } scrollTo(0, 0) })
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBeTruthy()
    }
    expect(errors).toEqual([])
  })
}

test('assignment journey integrates accounts, catalog filters, seller selection, guest protection, payment and key history', async ({ page, request }) => {
  const errors = observe(page)
  const email = 'audit-' + crypto.randomUUID() + '@example.test'
  const password = crypto.randomUUID()
  await page.goto('/register')
  await page.getByLabel('Name', { exact: true }).fill('Assignment Auditor')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Your account', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/')
  await page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page.locator('#best-sellers .product-card').first()).toBeVisible()
  await page.getByRole('banner').getByRole('link', { name: 'Your account', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/')

  const catalog = (await (await request.get('/api/v1/products?type=game&per_page=48')).json()).data
  let selected
  for (const candidate of catalog.filter((item: { slug: string }) => !item.slug.includes('stardew'))) {
    const product = (await (await request.get('/api/v1/products/' + candidate.slug)).json()).data
    const offer = product.offers.filter((item: { stock_available: number }) => item.stock_available >= 5).at(-1)
    if (offer) { selected = { product, offer }; break }
  }
  expect(selected).toBeTruthy()
  const { product, offer } = selected!
  const filters = new URLSearchParams({ q: product.title, 'platforms[]': product.platform.slug, 'regions[]': product.region.code, 'categories[]': product.categories[0].slug, price_min: String(product.price_minor), price_max: String(product.price_minor + 1000), sort: 'price_asc' })
  const expected = (await (await request.get('/api/v1/products?' + filters)).json()).data
  await page.goto('/store?' + filters)
  await expect.poll(() => page.locator('.product-card').evaluateAll(items => items.map(item => item.getAttribute('data-product-id')))).toEqual(expected.map((item: { id: string }) => item.id))
  await page.locator('.product-card[data-product-id="' + product.id + '"]').getByRole('link').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.title)
  await expect(page.locator('.seller-offer')).toHaveCount(product.offers.length)
  await page.locator('[data-offer-id="' + offer.id + '"]').getByRole('button', { name: /^Add to cart from / }).click()
  await expect(page.locator('.offer-feedback[role="status"]')).toBeVisible()
  await page.goto('/cart')
  await page.getByRole('button', { name: /^Increase quantity/ }).click()
  await expect(page.locator('.quantity-control > span')).toHaveText('2')
  const cart = (await (await page.request.get('/api/v1/cart')).json()).data
  expect(cart.items[0].offer_id).toBe(offer.id)
  expect(cart.total_minor).toBe(offer.price_minor * 2)
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Sign in to continue', exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your order', exact: true })).toBeVisible()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  const keys = await page.locator('.demo-key code').allTextContents()
  expect(keys.length).toBe(2)
  expect(new Set(keys).size).toBe(2)
  expect(keys.every(key => key.startsWith('DEMO-'))).toBeTruthy()
  await page.getByRole('link', { name: 'Back to order history', exact: true }).click()
  await page.goto('/orders?page=9999')
  await expect(page.getByRole('heading', { name: 'No orders on this page', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'First page', exact: true }).click()
  await page.getByRole('link', { name: 'View order and keys', exact: true }).click()
  await expect(page.locator('.demo-key code')).toHaveText(keys)
  expect(errors).toEqual([])
})
