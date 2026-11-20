import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/v1/health')
  expect(health.ok(), 'Start PostgreSQL and the Laravel API on port 8000 before UI tests.').toBeTruthy()
})

async function homeReady(page: import('@playwright/test').Page) {
  await expect(page.locator('#best-sellers .product-card')).toHaveCount(5)
  await expect(page.locator('#deals .product-card')).toHaveCount(5)
  await expect(page.locator('.category-placeholder')).toHaveCount(0)
  await expect(page.locator('#gift-cards .product-card')).toHaveCount(5)
  await expect(page.locator('#recommendations .product-card')).toHaveCount(5)
  await expect(page.locator('#popular-categories .category-link')).toHaveCount(10)
  await expect(page.locator('.hero-copy h2')).toBeVisible()
}

for (const [width, columns] of [[1440, 5], [768, 3], [390, 1]]) {
  test(`homepage responds at ${width}px without horizontal page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const sections = new Set<string>()
    page.on('request', request => { if (request.url().includes('/api/v1/home/')) sections.add(new URL(request.url()).pathname) })
    await page.goto('/')
    await homeReady(page)
    expect([...sections]).toEqual(expect.arrayContaining(['/api/v1/home/banners', '/api/v1/home/categories', '/api/v1/home/best-sellers', '/api/v1/home/deals', '/api/v1/home/gift-cards', '/api/v1/home/recommendations']))
    const geometry = await page.locator('#best-sellers .product-grid').evaluate(element => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.columns).toBe(columns)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport)
    await expect(page.getByText('INTERNSHIP DEMO', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('hero controls change the banner and its call to action navigates', async ({ page }) => {
  await page.goto('/')
  await homeReady(page)
  const title = await page.locator('.hero-copy h2').textContent()
  await page.getByRole('button', { name: /^Show promotion 2:/ }).click()
  await expect(page.locator('.hero-copy h2')).not.toHaveText(title!)
  await page.getByRole('link', { name: 'Explore offers', exact: true }).click()
  await expect(page).toHaveURL(/\/store$/)
  await expect(page.locator('.product-card')).toHaveCount(20)
})

test('keyboard typo suggestions navigate to the selected product', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox', { name: 'Search games and gift cards' })
  await input.fill('wicher')
  await expect(page.getByRole('option', { name: /The Witcher 3/ })).toBeVisible()
  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', /suggestions-0$/)
  await input.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Witcher 3: Wild Hunt')
  await expect(page.locator('.seller-offer')).toHaveCount(3)
})

test('superseded suggestions cannot replace the current search results', async ({ page }) => {
  await page.route('**/api/v1/search/suggestions?**', async route => {
    const response = await route.fetch()
    if (new URL(route.request().url()).searchParams.get('q') === 'elden') await new Promise(resolve => setTimeout(resolve, 650))
    try { await route.fulfill({ response }) } catch { /* Superseded browser requests are aborted by the query client. */ }
  })
  await page.goto('/')
  const input = page.getByRole('combobox', { name: 'Search games and gift cards' })
  await input.fill('elden')
  await page.waitForRequest(request => request.url().includes('/search/suggestions?q=elden'))
  await input.fill('cyberpnk')
  await expect(page.getByRole('option', { name: /Cyberpunk 2077/ })).toBeVisible()
  await page.waitForTimeout(750)
  await expect(page.getByRole('option', { name: /Elden Ring/ })).toHaveCount(0)
  await expect(input).toHaveValue('cyberpnk')
})

test('submitted search and filtering are reflected in the URL', async ({ page }) => {
  await page.goto('/store')
  const input = page.getByRole('combobox', { name: 'Search games and gift cards' })
  await input.fill('elden')
  await input.press('Enter')
  await expect(page).toHaveURL(/q=elden/)
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click()
  await page.getByRole('checkbox', { name: 'Racing', exact: true }).check()
  await expect(page).toHaveURL(/categories%5B%5D=racing/)
  await expect(page.locator('.product-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Remove Racing filter' }).click()
  await expect(page.locator('.product-card')).toHaveCount(20)
})

test('price sorting and range validation use actual rendered prices', async ({ page }) => {
  await page.goto('/store')
  await page.getByLabel('Sort products').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page.locator('.product-card')).toHaveCount(20)
  const values = await page.locator('.product-price').allTextContents()
  const prices = values.map(value => Number(value.replace(/[^\d.]/g, '')))
  expect(prices).toEqual([...prices].sort((a, b) => a - b))
  await page.getByLabel('Min €', { exact: true }).fill('30')
  await page.getByLabel('Max €', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Apply price' }).click()
  await expect(page.getByRole('alert')).toHaveText('Minimum price must not exceed maximum price.')
  await page.getByLabel('Min €', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Apply price' }).click()
  await expect(page).toHaveURL(/price_min=1000/)
  await expect(page.locator('.product-card').first()).toBeVisible()
  const ranged = (await page.locator('.product-price').allTextContents()).map(value => Number(value.replace(/[^\d.]/g, '')))
  expect(ranged.length).toBeGreaterThan(0)
  expect(ranged.every(value => value >= 10 && value <= 20)).toBeTruthy()
})

test('pagination and browser back preserve the catalog state', async ({ page }) => {
  await page.goto('/store?sort=title_asc')
  await expect(page.locator('.product-card')).toHaveCount(20)
  const first = await page.locator('.product-card h3').first().textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.product-card h3').first()).not.toHaveText(first!)
  await page.goBack()
  await expect(page.locator('.product-card h3').first()).toHaveText(first!)
  await expect(page.getByLabel('Sort products')).toHaveValue('title_asc')
})

test('mobile navigation, search, and filters have working dialogs and focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const menu = page.getByRole('dialog', { name: 'Explore Keymarket' })
  await expect(menu).toBeVisible()
  await menu.getByRole('link', { name: 'Gift cards', exact: true }).click()
  await expect(menu).not.toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gift cards')
  await expect(page.locator('.product-card')).toHaveCount(8)
  await page.getByRole('button', { name: 'Open filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Product filters' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('checkbox', { name: 'Steam', exact: true }).check()
  await drawer.getByRole('button', { name: 'Show results' }).click()
  await expect(drawer).not.toBeVisible()
  await expect(page.locator('.product-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Open filters' }).click()
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open filters' })).toBeFocused()
  await page.getByRole('button', { name: 'Open search' }).click()
  await expect(page.getByRole('combobox', { name: 'Search games and gift cards' })).toBeFocused()
})

const homeSections = [
  { endpoint: 'banners', selector: '#promotional-banners', error: 'Promotions could not load', empty: 'No active promotions', loading: 'Loading marketplace content' },
  { endpoint: 'categories', selector: '#popular-categories', error: 'Categories are unavailable', empty: 'No popular categories yet', loading: 'Loading popular categories' },
  { endpoint: 'best-sellers', selector: '#best-sellers', error: 'Best sellers could not load', empty: 'Nothing here just yet', loading: 'Loading marketplace content' },
  { endpoint: 'deals', selector: '#deals', error: 'Deals worth discovering could not load', empty: 'Nothing here just yet', loading: 'Loading marketplace content' },
  { endpoint: 'gift-cards', selector: '#gift-cards', error: 'Popular gift cards could not load', empty: 'Nothing here just yet', loading: 'Loading marketplace content' },
  { endpoint: 'recommendations', selector: '#recommendations', error: 'Recommended products could not load', empty: 'Nothing here just yet', loading: 'Loading marketplace content' },
]

async function otherSectionsReady(page: import('@playwright/test').Page, failed: string) {
  for (const section of homeSections.filter(section => section.endpoint !== failed)) {
    if (section.endpoint === 'banners') await expect(page.locator('.hero-copy h2')).toBeVisible()
    else if (section.endpoint === 'categories') await expect(page.locator('#popular-categories .category-link')).toHaveCount(10)
    else await expect(page.locator(section.selector + ' .product-card')).toHaveCount(5)
  }
}

for (const section of homeSections) {
  test(`homepage ${section.endpoint} failure is isolated and its retry restores content`, async ({ page }) => {
    let fail = true
    await page.route('**/api/v1/home/' + section.endpoint, route => fail ? route.fulfill({ status: 503, json: { error: { message: 'Temporarily unavailable.' } } }) : route.continue())
    await page.goto('/')
    await expect(page.locator(section.selector).getByText(section.error, { exact: true })).toBeVisible()
    await otherSectionsReady(page, section.endpoint)
    fail = false
    await page.locator(section.selector).getByRole('button', { name: 'Try again' }).click()
    await homeReady(page)
  })

  test(`homepage ${section.endpoint} has a loading and empty state without fallback content`, async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/api/v1/home/' + section.endpoint, async route => {
      await gate
      await route.fulfill({ json: { data: [] } })
    })
    try {
      await page.goto('/')
      await expect(page.locator(section.selector).getByRole('status', { name: section.loading })).toBeVisible()
      await otherSectionsReady(page, section.endpoint)
      release()
      await expect(page.locator(section.selector).getByText(section.empty, { exact: true })).toBeVisible()
      await expect(page.locator(section.selector + ' .product-card')).toHaveCount(0)
      if (section.endpoint === 'banners') await expect(page.locator('.hero-copy')).toHaveCount(0)
      if (section.endpoint === 'categories') await expect(page.locator('#popular-categories .category-link')).toHaveCount(0)
      await expect(page.locator(section.selector).getByRole('link', { name: /catalog/i }).first()).toBeVisible()
    } finally {
      release()
    }
  })
}

test('every homepage section renders the matching seeded endpoint data', async ({ page, request }) => {
  const responses = await Promise.all(homeSections.map(async section => {
    const response = await request.get('/api/v1/home/' + section.endpoint)
    expect(response.ok()).toBeTruthy()
    return [section.endpoint, (await response.json()).data] as const
  }))
  const data = Object.fromEntries(responses)
  await page.goto('/')
  await homeReady(page)
  await expect(page.locator('.hero-copy h2')).toHaveText(data.banners[0].title)
  await expect(page.locator('.hero-image')).toHaveAttribute('src', data.banners[0].image_url)
  const links = page.locator('#popular-categories .category-link').filter({ hasNotText: 'All products' })
  await expect(links).toHaveText(data.categories.map((category: { name: string }) => category.name))
  for (const section of homeSections.filter(section => !['banners', 'categories'].includes(section.endpoint))) {
    const cards = page.locator(section.selector + ' .product-card')
    expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-product-id'))))
      .toEqual(data[section.endpoint].slice(0, 5).map((product: { id: string }) => product.id))
    const product = data[section.endpoint][0]
    await expect(cards.first().locator('h3')).toHaveText(product.title)
    await expect(cards.first().locator('img')).toHaveAttribute('src', product.cover_image_url)
    await expect(cards.first().locator('.product-price')).toHaveText(new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(product.price_minor / 100))
  }
})

for (const section of ['best-sellers', 'deals', 'gift-cards', 'recommendations']) {
  test(`homepage ${section} card opens the correct product details`, async ({ page, request }) => {
    const response = await request.get('/api/v1/home/' + section)
    const product = (await response.json()).data[0]
    await page.goto('/')
    const card = page.locator('#' + section + ' .product-card').first()
    await expect(card.locator('a')).toHaveAttribute('href', '/products/' + product.slug)
    await card.locator('a').click()
    await expect(page).toHaveURL(new RegExp('/products/' + product.slug + '$'))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.title)
    await expect(page.locator('.seller-offer')).toHaveCount(3)
  })
}

test('popular category link opens the matching database-backed store facet', async ({ page, request }) => {
  const response = await request.get('/api/v1/home/categories')
  const category = (await response.json()).data[0]
  await page.goto('/')
  await page.locator('#popular-categories').getByRole('link', { name: category.name, exact: true }).click()
  expect(new URL(page.url()).searchParams.getAll('categories[]')).toEqual([category.slug])
  await expect(page.locator('.product-card').first()).toBeVisible()
})

test('seller offer details expand and purchase controls are not faked', async ({ page, request }) => {
  const response = await request.get('/api/v1/products?per_page=1')
  const product = (await response.json()).data[0]
  await page.goto('/products/' + product.slug)
  await expect(page.locator('.seller-offer')).toHaveCount(3)
  const offer = page.locator('.seller-offer').first()
  await offer.locator('summary').click()
  await expect(offer.getByText(/Prices and seller ratings are fictional demo data/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Add to cart from/i })).toHaveCount(3)
  await expect(page.getByRole('button', { name: /buy now|checkout/i })).toHaveCount(0)
  await expect(page.getByText(/Only nonredeemable demo keys are delivered/)).toBeVisible()
})

test('missing products and unmatched routes have real recovery links', async ({ page }) => {
  await page.goto('/products/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Browse the catalog' }).click()
  await expect(page).toHaveURL(/\/store$/)
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to discovery' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('skip link moves keyboard focus to the main landmark', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main-content')
})

for (const width of [1440, 390]) {
  for (const route of ['/', '/store', '/about', '/products']) {
    test(`accessibility scan at ${width}px on ${route}`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: 1000 })
      let destination = route
      if (route === '/products') {
        const response = await request.get('/api/v1/products?per_page=1')
        const { data } = await response.json()
        destination = '/products/' + data[0].slug
      }
      await page.goto(destination)
      if (route === '/products') await expect(page.locator('.seller-offer')).toHaveCount(3)
      if (route === '/') await homeReady(page)
      if (route === '/store') await expect(page.locator('.product-card')).toHaveCount(20)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
