import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const pay = (page: Page) => page.getByRole('button', { name: /^Pay .*· demo$/ })
const sample = (page: Page, name = 'Approved') => page.getByRole('button', { name: new RegExp('^' + name + ' ') })
const consent = (page: Page) => page.getByRole('checkbox', { name: 'I reviewed the seller prices, stock, platforms and activation regions.' })
const cardFields = ['Cardholder name', 'Card number', 'Expiry date', 'CVC', 'Postal code']

async function expectEmptyCard(page: Page) {
  for (const label of cardFields) await expect(page.getByLabel(label, { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Billing country', { exact: true })).toHaveValue('')
}

async function prepareCheckout(page: Page) {
  const products = (await (await page.request.get('/api/v1/products?type=game&per_page=48')).json()).data
  for (const item of products.filter((product: { slug: string }) => !product.slug.includes('stardew'))) {
    const product = (await (await page.request.get('/api/v1/products/' + item.slug)).json()).data
    const offer = product.offers.find((offer: { stock_available: number }) => offer.stock_available >= 5)
    if (!offer) continue
    await page.goto('/products/' + product.slug)
    await page.locator('[data-offer-id="' + offer.id + '"]').getByRole('button', { name: /^Add to cart from / }).click()
    await page.getByRole('link', { name: 'View cart', exact: true }).click()
    await page.getByRole('link', { name: 'Sign in to checkout', exact: true }).click()
    await page.getByRole('link', { name: 'Create account', exact: true }).click()
    const account = { email: 'card-' + crypto.randomUUID() + '@example.test', password: crypto.randomUUID() }
    await page.getByLabel('Name', { exact: true }).fill('Demo Card Buyer')
    await page.getByLabel('Email', { exact: true }).fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    await page.getByLabel('Confirm password', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Create demo account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Review your order', exact: true })).toBeVisible()
    await expect(sample(page)).toBeEnabled()
    await expect(page.locator('.checkout-item')).toHaveCount(1)
    return account
  }
  throw new Error('Development inventory needs an available game offer with at least five demo keys.')
}

async function storage(page: Page) {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
}

test('required, unsupported and invalid fields block payment and associate inline errors', async ({ page }) => {
  await prepareCheckout(page)
  const requests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/checkout') requests.push(request.postData() ?? '') })
  await expect(pay(page)).toBeDisabled()
  await consent(page).check()
  await pay(page).click()
  await expect(page.getByLabel('Cardholder name', { exact: true })).toBeFocused()
  for (const label of [...cardFields, 'Billing country']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-describedby', /-error$/)
  }
  await sample(page).click()
  await page.getByLabel('Cardholder name', { exact: true }).fill('MEMORY ONLY SHOPPER')
  await expect(page.locator('.preview-bottom')).toContainText('MEMORY ONLY SHOPPER')
  await page.getByLabel('Card number', { exact: true }).fill('4111111111111111')
  await expect(page.getByLabel('Card number', { exact: true })).toHaveValue('4111 1111 1111 1111')
  await pay(page).click()
  await expect(page.getByLabel('Card number', { exact: true })).toBeFocused()
  await expect(page.getByText('Use one of the sample test cards below.', { exact: true })).toBeVisible()
  // A longer input beginning with an allowed number must never be truncated into approval.
  await page.getByLabel('Card number', { exact: true }).fill('42424242424242429')
  await pay(page).click()
  await expect(page.getByLabel('Card number', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Card number', { exact: true }).fill('4242424242424242')
  const now = new Date()
  for (const expiry of ['00/39', '13/39', '01/20', String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getFullYear()).slice(-2)]) {
    await page.getByLabel('Expiry date', { exact: true }).fill(expiry)
    await pay(page).click()
    await expect(page.getByLabel('Expiry date', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  }
  await page.getByLabel('Expiry date', { exact: true }).fill('1239')
  await expect(page.getByLabel('Expiry date', { exact: true })).toHaveValue('12/39')
  await expect(page.locator('.preview-bottom')).toContainText('12/39')
  await page.getByLabel('CVC', { exact: true }).fill('12')
  await pay(page).click()
  await expect(page.getByLabel('CVC', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('CVC', { exact: true })).toHaveAttribute('type', 'password')
  expect(requests).toEqual([])
  expect(await storage(page)).toEqual({ local: {}, session: {} })
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(0)
})

test('one approved submission clears card memory immediately and sends only checkout metadata', async ({ page, baseURL }) => {
  await prepareCheckout(page)
  const outbound: { url: string; data: string | null }[] = []
  const logs: string[] = []
  page.on('request', request => outbound.push({ url: request.url(), data: request.postData() }))
  page.on('console', message => logs.push(message.text()))
  await sample(page).click()
  await page.getByLabel('Cardholder name', { exact: true }).fill('MEMORY ONLY SHOPPER')
  await page.getByLabel('Expiry date', { exact: true }).fill('1239')
  await page.getByLabel('CVC', { exact: true }).fill('987')
  await page.getByLabel('Postal code', { exact: true }).fill('ZX-PRIVACY-83')
  await expect(page.locator('.preview-number')).toHaveText('•••• •••• •••• 4242')
  expect(await storage(page)).toEqual({ local: {}, session: {} })
  const quote = (await (await page.request.get('/api/v1/checkout/quote')).json()).data
  await expect(pay(page)).toHaveAccessibleName('Pay ' + new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(quote.cart.total_minor / 100) + ' · demo')
  await consent(page).check()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let reached!: () => void
  const ready = new Promise<void>(resolve => { reached = resolve })
  const sent: Record<string, string>[] = []
  await page.route('**/api/v1/checkout', async route => { sent.push(route.request().postDataJSON()); reached(); await held; await route.continue() })
  try {
    await page.evaluate(() => { const form = document.querySelector<HTMLFormElement>('.demo-card-form')!; form.requestSubmit(); form.requestSubmit() })
    await ready
    await expect(page.getByRole('button', { name: 'Processing demo payment…', exact: true })).toBeDisabled()
    await expectEmptyCard(page)
    expect(sent).toHaveLength(1)
    expect(Object.keys(sent[0]).sort()).toEqual(['idempotency_key', 'quote_token', 'scenario'])
    expect(sent[0].scenario).toBe('approve')
    const stored = await storage(page)
    expect(stored.local).toEqual({})
    expect(Object.keys(stored.session)).toHaveLength(1)
    expect(JSON.parse(Object.values(stored.session)[0])).toEqual(sent[0])
    for (const request of outbound) {
      expect(new URL(request.url).origin).toBe(new URL(baseURL!).origin)
      for (const value of ['MEMORY ONLY SHOPPER', 'ZX-PRIVACY-83', '4242424242424242', '4242 4242 4242 4242', '12/39']) expect(request.url + (request.data ?? '')).not.toContain(value)
    }
    expect(logs.some(log => /MEMORY ONLY SHOPPER|ZX-PRIVACY-83|4242 4242 4242 4242|4242424242424242|12\/39/.test(log))).toBeFalsy()
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  await expect(page.locator('.checkout-steps [aria-current="step"]')).toContainText('Demo keys')
  await expect(page.locator('.demo-key code')).toHaveCount(1)
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(1)
  expect(await storage(page)).toEqual({ local: {}, session: {} })
})

test('simulated verification rejects a wrong code, traps focus and approves only after confirmation', async ({ page }) => {
  await prepareCheckout(page)
  const sent: object[] = []
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/checkout') sent.push(request.postDataJSON()) })
  await sample(page, 'Verification').click()
  await consent(page).check()
  await pay(page).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Verify your demo payment', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('SIMULATED VERIFICATION')
  await expect(dialog).toContainText('No bank is contacted.')
  const code = dialog.getByLabel('Verification code', { exact: true })
  await expect(code).toBeFocused()
  await code.fill('000000')
  await code.press('Enter')
  await expect(dialog.getByRole('alert')).toHaveText('Use the demo verification code 123456.')
  await expect(code).toHaveAttribute('aria-invalid', 'true')
  await expect(code).toBeFocused()
  expect(sent).toHaveLength(0)
  expect(await storage(page)).toEqual({ local: {}, session: {} })
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(0)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: '../docs/ui-screenshots/keymarket-demo-verification-1440.png' })
  await code.fill('123456')
  await code.press('Enter')
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(Object.keys(sent[0]).sort()).toEqual(['idempotency_key', 'quote_token', 'scenario'])
  expect((sent[0] as { scenario: string }).scenario).toBe('approve')
  expect(await storage(page)).toEqual({ local: {}, session: {} })
})

test('verification cancellation and Escape at 320px clear fields, retain the cart and allow another attempt', async ({ page }) => {
  // Two complete modal cancellation cycles plus a real registration/cart merge and purchase.
  test.setTimeout(45_000)
  await page.setViewportSize({ width: 320, height: 900 })
  await prepareCheckout(page)
  const sent: object[] = []
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/checkout') sent.push(request.postDataJSON()) })
  for (const escape of [true, false]) {
    await sample(page, 'Verification').click()
    await consent(page).check()
    await pay(page).click()
    const dialog = page.getByRole('dialog', { name: 'Verify your demo payment', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Verification code', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Cancel verification', exact: true })).toBeFocused()
    if (escape) await page.keyboard.press('Escape')
    else await page.keyboard.press('Enter')
    await expect(dialog).not.toBeVisible()
    await expect(page.getByLabel('Cardholder name', { exact: true })).toBeFocused()
    await expectEmptyCard(page)
    await expect(consent(page)).not.toBeChecked()
    await expect(page.getByRole('status').filter({ hasText: 'Verification cancelled.' })).toBeVisible()
  }
  expect(sent).toHaveLength(0)
  expect((await (await page.request.get('/api/v1/cart')).json()).data.items_count).toBe(1)
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(0)
  await sample(page).click()
  await consent(page).check()
  await pay(page).click()
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
})

test('a lost result survives session expiry and is recovered with the same request after signing in', async ({ page }) => {
  const account = await prepareCheckout(page)
  const sent: object[] = []
  await page.route('**/api/v1/checkout', async route => {
    sent.push(route.request().postDataJSON())
    if (sent.length === 1) {
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      await route.abort('failed')
    } else await route.continue()
  })
  await sample(page).click()
  await consent(page).check()
  await pay(page).click()
  await expect(page.getByRole('heading', { name: 'Payment result needs confirmation', exact: true })).toBeVisible()
  const before = await storage(page)
  const csrf = decodeURIComponent((await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')!.value)
  expect((await page.request.post('/api/v1/auth/logout', { headers: { 'X-XSRF-TOKEN': csrf } })).ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Check payment result', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue', exact: true })).toBeVisible()
  expect(await storage(page)).toEqual(before)
  await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Check payment result', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your demo keys are ready', exact: true })).toBeVisible()
  expect(sent).toHaveLength(3)
  expect(sent.every(attempt => JSON.stringify(attempt) === JSON.stringify(sent[0]))).toBeTruthy()
  expect((await (await page.request.get('/api/v1/orders')).json()).meta.total).toBe(1)
  expect(await storage(page)).toEqual({ local: {}, session: {} })
})

for (const width of [1440, 768, 390, 320]) {
  test(`card form, preview and keyboard controls remain accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await prepareCheckout(page)
    await sample(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Card number', { exact: true })).toHaveValue('4242 4242 4242 4242')
    await expect(page.locator('.checkout-steps [aria-current="step"]')).toContainText('Payment')
    await expect(pay(page)).toBeDisabled()
    await consent(page).focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await expect(pay(page)).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    if (width !== 768) {
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: '../docs/ui-screenshots/keymarket-demo-card-' + width + '.png', fullPage: true })
    }
    if (width === 320) {
      await page.reload()
      await expectEmptyCard(page)
      await expect(consent(page)).not.toBeChecked()
    }
  })
}
