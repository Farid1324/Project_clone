import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Product } from '../src/types/api'

const artwork = JSON.parse(readFileSync(new URL('../../backend/database/seeders/data/cover-artwork.json', import.meta.url), 'utf8')) as {
  assets: { path: string; sha256: string; product_slugs: string[] }[]
}

async function allProducts(request: APIRequestContext): Promise<Product[]> {
  const response = await request.get('/api/v1/products?per_page=48&in_stock=false')
  expect(response.ok()).toBeTruthy()
  const catalog = await response.json()
  expect(catalog.meta.total).toBeGreaterThanOrEqual(40)
  // Fail rather than silently testing only the first page if the demo catalog grows.
  expect(catalog.data).toHaveLength(catalog.meta.total)
  return catalog.data
}

async function readData(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.ok(), path + ' returned HTTP ' + response.status()).toBeTruthy()
  return (await response.json()).data
}

async function loadVisibleCatalog(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
      scrollTo(0, y)
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    scrollTo(0, 0)
  })
  await expect.poll(() => page.locator('.product-cover img').evaluateAll(images => images.every(image => {
    const picture = image as HTMLImageElement
    return picture.complete && picture.naturalWidth > 0 && picture.naturalHeight > 0
  }))).toBeTruthy()
}

for (const width of [1440, 390]) {
  test(`every seeded catalog cover decodes without fallback at ${width}px`, async ({ page, request }) => {
    const response = await request.get('/api/v1/products?per_page=48&in_stock=false')
    expect(response.ok()).toBeTruthy()
    const catalog = await response.json()
    expect(catalog.meta.total).toBeGreaterThanOrEqual(40)
    expect(catalog.data).toHaveLength(catalog.meta.total)
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/store?per_page=48&in_stock=false')
    await expect(page.locator('.product-card')).toHaveCount(catalog.meta.total)
    await loadVisibleCatalog(page)
    expect(await page.locator('[data-artwork-fallback="true"]').count()).toBe(0)
    const covers = await page.locator('.product-cover img').evaluateAll(images => images.map(image => (image as HTMLImageElement).src))
    expect(covers.sort()).toEqual(catalog.data.map((product: { cover_image_url: string }) => product.cover_image_url).sort())
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    for (const cover of await page.locator('.product-cover').all()) {
      const bounds = await cover.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.height / bounds!.width).toBeCloseTo(1.5, 1)
    }
    await page.goto('/store?type=game&sort=popularity')
    await expect(page.locator('.product-card').first()).toBeVisible()
    await loadVisibleCatalog(page)
    await page.screenshot({ path: '../docs/ui-screenshots/keymarket-real-covers-store-' + width + '.png', fullPage: true })
  })
}

// Five disjoint batches retain the full sweep, with about nine navigations per case.
// A 45s case budget allows slow CI navigation without one 90s monolithic test.
for (let batch = 0; batch < 5; batch++) {
  test(`every seeded product detail has a decoded portrait cover, batch ${batch + 1}/5`, async ({ page, request }) => {
    test.setTimeout(45_000)
    const catalog = await allProducts(request)
    const products = catalog.filter((_, index) => index % 5 === batch)
    expect(products.length).toBeGreaterThan(0)
    for (const product of products) {
      await page.goto('/products/' + product.slug)
      const cover = page.locator('.detail-art img')
      await expect(cover).toHaveAttribute('src', product.cover_image_url)
      await expect.poll(() => cover.evaluate(image => {
        const picture = image as HTMLImageElement
        return picture.complete && picture.naturalWidth > 0 && picture.naturalHeight > picture.naturalWidth
      }), { message: product.slug }).toBeTruthy()
      await expect(cover).not.toHaveAttribute('data-artwork-fallback', 'true')
      const bounds = await cover.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.height / bounds!.width).toBeCloseTo(1.5, 1)
    }
  })
}

test('all catalog artwork is same-origin WebP with the exact verified local bytes', async ({ request, baseURL }) => {
  const catalog = await allProducts(request)
  expect(new Set(catalog.map(product => new URL(product.cover_image_url!).pathname)).size).toBe(artwork.assets.length)
  for (const asset of artwork.assets) {
    for (const slug of asset.product_slugs) {
      const product = catalog.find(item => item.slug === slug)
      expect(product, slug).toBeDefined()
      const url = new URL(product!.cover_image_url!)
      expect(url.origin).toBe(new URL(baseURL!).origin)
      expect(url.pathname).toBe(asset.path)
    }
    const response = await request.get(asset.path)
    expect(response.status(), asset.path).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^image\/webp(?:;|$)/)
    expect(createHash('sha256').update(await response.body()).digest('hex'), asset.path).toBe(asset.sha256)
  }
})

for (const width of [1440, 390]) {
  test(`homepage artwork decodes after scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto('/')
    for (const id of ['best-sellers', 'deals', 'gift-cards', 'recommendations']) {
      await expect(page.locator('#' + id + ' .product-card').first()).toBeVisible()
    }
    await loadVisibleCatalog(page)
    await expect.poll(() => page.locator('main img').evaluateAll(images => images.every(image => {
      const picture = image as HTMLImageElement
      return picture.complete && picture.naturalWidth > 0
    }))).toBeTruthy()
    expect(await page.locator('[data-artwork-fallback="true"]').count()).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    for (const cover of await page.locator('.product-cover').all()) {
      const bounds = await cover.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.height / bounds!.width).toBeCloseTo(1.5, 1)
    }
    expect(errors).toEqual([])
    await page.screenshot({ path: '../docs/ui-screenshots/keymarket-real-covers-home-' + width + '.png', fullPage: true })
  })
}

test('a broken primary and local fallback terminate visibly without an error loop and recover on a new URL', async ({ page, request }) => {
  const product = (await allProducts(request))[0]
  let broken = true
  let primaryRequests = 0
  let fallbackRequests = 0
  await page.route(/\/api\/v1\/products\?/, async route => {
    const response = await route.fetch()
    const body = await response.json()
    if (broken) body.data = body.data.map((item: Product) => item.id === product.id ? { ...item, cover_image_url: '/demo/broken-primary-test.webp' } : item)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/demo/broken-primary-test.webp', route => { primaryRequests++; return route.fulfill({ status: 404, body: 'Missing' }) })
  await page.route('**/demo/cover-unavailable.svg', route => { fallbackRequests++; return route.fulfill({ status: 404, body: 'Missing' }) })
  await page.goto('/store?per_page=48&in_stock=false')
  const card = page.locator('.product-card[data-product-id="' + product.id + '"]')
  await card.scrollIntoViewIfNeeded()
  const terminal = card.locator('[data-artwork-terminal="true"]')
  await expect(terminal).toBeVisible()
  // Card artwork is decorative: its adjacent title supplies the link's accessible name.
  await expect(terminal).toHaveAttribute('aria-hidden', 'true')
  await expect(terminal).toContainText('Artwork unavailable')
  await expect(card.locator('.product-cover img')).toHaveCount(0)
  await page.getByLabel('Sort products').focus()
  await page.keyboard.press('Tab')
  expect(primaryRequests).toBe(1)
  expect(fallbackRequests).toBe(1)
  broken = false
  await page.getByLabel('Sort products').selectOption('price_asc')
  await expect(card.locator('.product-cover img')).toHaveAttribute('src', product.cover_image_url!)
  await expect.poll(() => card.locator('.product-cover img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(terminal).toHaveCount(0)
})

test('wishlist uses the same backend cover and visible local fallback', async ({ page, request }) => {
  const product = (await allProducts(request))[0]
  await page.goto('/register?returnTo=/wishlist')
  await page.getByLabel('Name', { exact: true }).fill('Artwork Shopper')
  await page.getByLabel('Email', { exact: true }).fill('artwork-' + crypto.randomUUID() + '@example.test')
  const password = crypto.randomUUID()
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await expect(page).toHaveURL(/\/wishlist$/)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Wishlist, 0 saved products', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your wishlist is ready for its first game' })).toBeVisible()
  await page.goto('/products/' + product.slug)
  await page.locator('.detail-copy .wishlist-button').click()
  await page.getByRole('banner').getByRole('link', { name: 'Wishlist, 1 saved product', exact: true }).click()
  const cover = page.locator('.product-card[data-product-id="' + product.id + '"] img')
  await expect(cover).toHaveAttribute('src', product.cover_image_url!)
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(600)
  await page.route(product.cover_image_url!, route => route.abort())
  await page.reload()
  await expect(cover).toHaveAttribute('data-artwork-fallback', 'true')
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

for (const missing of ['empty', 'broken']) {
  test(`${missing} product artwork uses local fallback and recovers when its API URL changes`, async ({ page, request }) => {
    const product = (await readData(request, '/api/v1/products?per_page=1'))[0]
    let broken = true
    await page.route(/\/api\/v1\/products\?/, async route => {
      const response = await route.fetch()
      const body = await response.json()
      if (broken) body.data = body.data.map((item: { id: string }) => item.id === product.id ? { ...item, cover_image_url: missing === 'empty' ? '' : '/demo/missing-cover-for-test.svg' } : item)
      await route.fulfill({ response, json: body })
    })
    await page.route('**/demo/missing-cover-for-test.svg', route => route.fulfill({ status: 404, body: 'Not found' }))
    await page.goto('/store?per_page=48')
    const cover = page.locator('.product-card[data-product-id="' + product.id + '"] img')
    await cover.scrollIntoViewIfNeeded()
    await expect(cover).toHaveAttribute('data-artwork-fallback', 'true')
    await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    broken = false
    await page.getByLabel('Sort products').selectOption('price_asc')
    await expect(cover).toHaveAttribute('src', product.cover_image_url)
    await expect(cover).not.toHaveAttribute('data-artwork-fallback', 'true')
  })
}

test('detail, autocomplete and cart all use the local fallback for an unavailable cover', async ({ page, request }) => {
  const product = (await readData(request, '/api/v1/products?per_page=1'))[0]
  await page.route(product.cover_image_url, route => route.abort())
  await page.goto('/products/' + product.slug)
  await expect(page.locator('.detail-art img')).toHaveAttribute('data-artwork-fallback', 'true')
  await expect(page.locator('.detail-art img')).toHaveAttribute('alt', /Artwork unavailable/)
  await page.getByRole('combobox', { name: 'Search games and gift cards' }).fill(product.title)
  const suggestion = page.getByRole('option').filter({ hasText: product.title }).first()
  await expect(suggestion.locator('img')).toHaveAttribute('data-artwork-fallback', 'true')
  await page.getByRole('combobox', { name: 'Search games and gift cards' }).press('Escape')
  await page.getByRole('button', { name: /^Add to cart from / }).filter({ visible: true }).first().click()
  await page.getByRole('link', { name: 'View cart', exact: true }).click()
  await expect(page.locator('.cart-line-art img')).toHaveAttribute('data-artwork-fallback', 'true')
  await expect.poll(() => page.locator('.cart-line-art img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('.cart-product-title')).toHaveText(product.title)
})

for (const width of [1440, 390]) {
  test(`detail, autocomplete and cart render the selected real cover at ${width}px`, async ({ page, request }) => {
    const product = (await readData(request, '/api/v1/products?per_page=1'))[0]
    await page.setViewportSize({ width, height: 1000 })
    const check = async (selector: string) => {
      const cover = page.locator(selector).first()
      await expect(cover).toHaveAttribute('src', product.cover_image_url)
      await expect(cover).not.toHaveAttribute('data-artwork-fallback', 'true')
      await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(600)
      const bounds = await cover.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.height / bounds!.width).toBeCloseTo(1.5, 1)
    }
    await page.goto('/products/' + product.slug)
    await check('.detail-art img')
    if (width < 1024) await page.getByRole('button', { name: 'Open search', exact: true }).click()
    const search = page.getByRole('combobox', { name: 'Search games and gift cards' }).filter({ visible: true })
    await search.fill(product.title)
    await expect(page.getByRole('option').first()).toContainText(product.title)
    await check('[role="option"] img')
    await search.press('Escape')
    if (width < 1024) await page.getByRole('button', { name: 'Close search', exact: true }).click()
    await page.getByRole('button', { name: /^Add to cart from / }).filter({ visible: true }).first().click()
    await page.getByRole('link', { name: 'View cart', exact: true }).click()
    await check('.cart-line-art img')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  })
}

test('hero artwork failure keeps carousel text and navigation usable', async ({ page, request }) => {
  const banners = await readData(request, '/api/v1/home/banners')
  for (const banner of banners) await page.route(banner.image_url, route => route.abort())
  await page.goto('/')
  await expect(page.locator('.hero-image')).toHaveAttribute('data-artwork-fallback', 'true')
  await expect(page.locator('.hero-copy h2')).toHaveText(banners[0].title)
  await page.getByRole('button', { name: 'Show promotion 2: ' + banners[1].title, exact: true }).click()
  await expect(page.locator('.hero-copy h2')).toHaveText(banners[1].title)
  await expect(page.locator('.hero-image')).toHaveAttribute('data-artwork-fallback', 'true')
  await page.locator('.hero-copy').getByRole('link', { name: 'Explore offers', exact: true }).click()
  await expect(page).toHaveURL(/\/store$/)
})
