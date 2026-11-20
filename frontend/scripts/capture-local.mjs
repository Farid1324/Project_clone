import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const output = path.resolve('../docs/ui-screenshots')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const product = await fetch(baseURL + '/api/v1/products?per_page=1').then(response => response.json())
const observations = []
for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const productRoute = '/products/' + product.data[0].slug
  const routes = name === 'tablet' ? [['home', '/']] : [['home', '/'], ['store', '/store'], ['product', productRoute], ['cart', '/cart']]
  for (const [label, route] of routes) {
    if (label === 'cart') {
      await page.goto(baseURL + productRoute)
      await page.getByRole('button', { name: /^Add to cart from / }).first().click()
      await page.locator('.offer-feedback[role="status"]').waitFor()
    }
    await page.goto(baseURL + route)
    await page.waitForSelector(label === 'product' ? '.seller-offer' : label === 'cart' ? '.cart-line' : '.product-card')
    if (label === 'home') {
      await page.waitForSelector('#gift-cards .product-card')
      await page.waitForSelector('#recommendations .product-card')
      await page.waitForSelector('#popular-categories .category-link')
      await page.waitForFunction(() => document.querySelectorAll('.category-placeholder').length === 0)
    }
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 40)) }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(200)
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    const file = `keymarket-${label}-${name}-${width}`
    await page.screenshot({ path: path.join(output, file + '.png'), fullPage: false })
    await page.screenshot({ path: path.join(output, file + '-full.png'), fullPage: true })
    const metrics = await page.evaluate(() => {
      const rect = selector => { const element = document.querySelector(selector); if (!element) return null; const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height } }
      return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(document.body).backgroundColor,
        container: rect('.market-container'), header: rect('.header-main'), search: rect('.desktop-search .search-field'), hero: rect('.hero-main'), card: rect('.product-card'),
        columns: getComputedStyle(document.querySelector('.product-grid') ?? document.body).gridTemplateColumns,
        unloadedImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src) }
    })
    observations.push({ page: label, width, height, screenshot: file + '.png', fullScreenshot: file + '-full.png', ...metrics, errors: [...errors] })
  }
  await context.close()
}
await browser.close()
await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2))
console.log(JSON.stringify(observations, null, 2))
