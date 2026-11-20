import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const output = path.resolve('../docs/ui-screenshots')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const observations = []
for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
  const context = await browser.newContext({ baseURL, viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  async function capture(label) {
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    const file = `keymarket-${label}-${name}-${width}`
    await page.screenshot({ path: path.join(output, file + '.png'), fullPage: false })
    await page.screenshot({ path: path.join(output, file + '-full.png'), fullPage: true })
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    observations.push({ page: label, width, height, screenshot: file + '.png', fullScreenshot: file + '-full.png', ...metrics, errors: [...errors] })
  }
  const list = (await (await context.request.get('/api/v1/products?type=game&per_page=48')).json()).data
  let selected
  for (const candidate of list.filter(product => !product.slug.includes('stardew'))) {
    const product = (await (await context.request.get('/api/v1/products/' + candidate.slug)).json()).data
    const offer = product.offers.find(item => item.stock_available >= 3)
    if (offer) { selected = { product, offer }; break }
  }
  if (!selected) throw new Error('Seed available demo inventory before capturing purchasing pages.')
  await page.goto('/products/' + selected.product.slug)
  await page.locator(`[data-offer-id="${selected.offer.id}"]`).getByRole('button', { name: /^Add to cart from / }).click()
  await page.locator('.offer-feedback[role="status"]').waitFor()
  await page.goto('/login?returnTo=%2Fcheckout')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await capture('login')
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Demo Buyer')
  await page.getByLabel('Email', { exact: true }).fill('capture-' + crypto.randomUUID() + '@example.test')
  await page.getByLabel('Password', { exact: true }).fill('A safe demo passphrase 2027')
  await page.getByLabel('Confirm password', { exact: true }).fill('A safe demo passphrase 2027')
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
  await page.locator('.checkout-item').waitFor()
  await capture('checkout')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click()
  await page.locator('.demo-key code').waitFor()
  await capture('confirmation')
  await page.getByRole('link', { name: 'Back to order history', exact: true }).click()
  await page.locator('.order-history-card').waitFor()
  await capture('orders')
  await context.close()
}
await browser.close()
await writeFile(path.join(output, 'purchasing-observations.json'), JSON.stringify(observations, null, 2) + '\n')
console.log(JSON.stringify({ captures: observations.length, overflow: observations.filter(item => item.scrollWidth !== item.width).length, browserErrors: observations.flatMap(item => item.errors) }))
