import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

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
  })
}

test('every seeded product detail has a decoded portrait cover', async ({ page, request }) => {
  test.setTimeout(90_000)
  const catalog = await readData(request, '/api/v1/products?per_page=48&in_stock=false')
  for (const product of catalog) {
    await page.goto('/products/' + product.slug)
    const cover = page.locator('.detail-art img')
    await expect(cover).toHaveAttribute('src', product.cover_image_url)
    await expect.poll(() => cover.evaluate(image => {
      const picture = image as HTMLImageElement
      return picture.complete && picture.naturalWidth > 0 && picture.naturalHeight > picture.naturalWidth
    }), { message: product.slug }).toBeTruthy()
    await expect(cover).not.toHaveAttribute('data-artwork-fallback', 'true')
  }
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
