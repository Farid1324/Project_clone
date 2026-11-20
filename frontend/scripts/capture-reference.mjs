import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('../docs/ui-reference')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const observations = []
const routes = [['home', 'https://www.eneba.com/'], ['store', 'https://www.eneba.com/store/games'], ['product', 'https://www.eneba.com/other-minecraft-java-bedrock-edition-pc-official-website-key-global']]
for (const [name, width, height, mobile] of [['desktop', 1440, 1000, false], ['mobile', 390, 844, true]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'en-GB' })
  const page = await context.newPage()
  for (const [label, url] of routes) {
  let navigationError = null
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }) } catch (error) { navigationError = error.message }
  await page.waitForTimeout(3500)
  const close = page.getByRole('button', { name: 'Close', exact: true }).last();
  const closeBox = await close.isVisible() ? await close.boundingBox() : null
  if (closeBox && closeBox.x >= 0 && closeBox.y >= 0 && closeBox.x < width && closeBox.y < height) await close.click({ timeout: 3000 }).catch(() => {})
  const consent = page.getByRole('button', { name: 'Accept all', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.waitForTimeout(300);
  const observation = await page.evaluate(() => {
    const sample = (element) => {
      if (!element) return null
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      return { tag: element.tagName, background: style.backgroundColor, color: style.color, font: style.fontFamily, fontSize: style.fontSize, radius: style.borderRadius, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    }
    return { title: document.title, url: location.href, body: sample(document.body), search: sample(document.querySelector('input')), headings: [...document.querySelectorAll('h1,h2')].slice(0, 10).map(sample) }
  })
  const file = label === 'home' ? `eneba-${name}-${width}.png` : `eneba-${label}-${name}-${width}.png`
  await page.screenshot({ path: path.join(output, file), fullPage: false })
  observations.push({ page: label, name, width, height, capturedAt: new Date().toISOString(), navigationError, screenshot: file, ...observation })
  }
  await context.close()
}
await browser.close()
await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2))
console.log(JSON.stringify(observations.map(({ page, width, screenshot, navigationError }) => ({ page, width, screenshot, navigationError })), null, 2))
