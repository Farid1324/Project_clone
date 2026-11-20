import assert from 'node:assert/strict'
import { lookup } from 'node:dns/promises'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input || input === '--help') {
  console.log('Usage: node frontend/scripts/verify-public.mjs https://YOUR-PUBLIC-HOST')
  console.log('Read-only checks. Writes docs/public-verification.json; does not register users or purchase keys.')
  process.exit(input ? 0 : 1)
}

const report = { status: 'failed', public_url: null, checked_at: new Date().toISOString(), scope: 'read-only public HTTPS smoke checks; purchasing still needs browser verification', checks: [] }
const output = fileURLToPath(new URL('../../docs/public-verification.json', import.meta.url))
try {
  const url = new URL(input)
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && ['/', ''].includes(url.pathname), 'Provide a public HTTPS origin without credentials or a path.')
  assert(!url.hostname.endsWith('localhost'), 'Loopback is not a public deployment.')
  const addresses = await lookup(url.hostname, { all: true })
  assert(addresses.length && addresses.every(({ address }) => !/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|f[cd][\da-f]{2}:|fe80:)/i.test(address)), 'A public URL must resolve outside private/loopback networks.')
  const origin = url.origin
  report.public_url = origin
  async function get(path, expected = 200) {
    const target = new URL(path, origin)
    assert(target.origin === origin, 'Cross-origin resource detected.')
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(60_000), headers: { Accept: 'application/json' } })
    assert.equal(response.status, expected, `${target.pathname}: expected ${expected}, received ${response.status}`)
    report.checks.push({ path: target.pathname, status: response.status })
    return response
  }
  const health = await (await get('/api/v1/health')).json()
  assert.equal(health.data.status, 'ready')
  const htmlResponse = await get('/')
  const html = await htmlResponse.text()
  assert(html.includes('id="root"') && htmlResponse.headers.get('content-type')?.includes('text/html'), 'Compiled React root is missing.')
  assert(htmlResponse.headers.get('content-security-policy')?.includes("connect-src 'self'"), 'Expected same-origin content security policy.')
  const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1])
  assert(assets.length >= 2, 'Compiled JavaScript and CSS references are missing.')
  for (const asset of assets) {
    const response = await get(asset)
    assert(!response.headers.get('content-type')?.includes('text/html'), 'An asset returned the SPA fallback.')
    assert(response.headers.get('cache-control')?.includes('immutable'), 'Hashed assets should use immutable caching.')
  }
  const products = (await (await get('/api/v1/products?per_page=48&in_stock=false')).json()).data
  assert(products.length >= 40, 'Seeded marketplace catalog is missing.')
  const product = (await (await get('/api/v1/products/' + products[0].slug)).json()).data
  assert(product.offers.length >= 2 && product.offers.every(offer => offer.product_id === product.id), 'Independent seller relationships are missing.')
  const banners = (await (await get('/api/v1/home/banners')).json()).data
  const imageUrls = new Set([...products.map(item => item.cover_image_url), ...banners.map(item => item.image_url)])
  for (const image of imageUrls) {
    const response = await get(image)
    assert(response.headers.get('content-type')?.startsWith('image/'), 'A demo image returned another content type.')
  }
  for (const section of ['categories', 'best-sellers', 'deals', 'gift-cards', 'recommendations']) {
    const data = (await (await get('/api/v1/home/' + section)).json()).data
    assert(data.length > 0, 'A seeded homepage section is empty: ' + section)
  }
  for (const [q, expected] of [['elden', 'Elden Ring'], ['minecraf', 'Minecraft']]) {
    const data = (await (await get('/api/v1/products?' + new URLSearchParams({ q }))).json()).data
    assert(data.some(item => item.title.includes(expected)), 'Search failed: ' + q)
  }
  for (const path of ['/store', '/login', '/register', '/cart', '/checkout', '/orders', '/products/' + product.slug]) {
    assert((await (await get(path)).text()).includes('id="root"'), 'Deep-link SPA fallback failed: ' + path)
  }
  const cart = await get('/api/v1/cart')
  const sessionCookie = cart.headers.getSetCookie().find(cookie => /;\s*httponly(?:;|$)/i.test(cookie))
  assert(sessionCookie && /;\s*secure(?:;|$)/i.test(sessionCookie) && /samesite=lax/i.test(sessionCookie), 'Secure HttpOnly SameSite session cookie is missing.')
  await get('/api/v1/checkout/quote', 401)
  await get('/api/v1/orders', 401)
  const missing = await (await get('/api/v1/public-verifier-missing', 404)).json()
  assert.equal(missing.error.code, 'not_found')
  await get('/assets/public-verifier-missing.js', 404)
  const secret = await fetch(origin + '/.env', { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  assert([403, 404].includes(secret.status), 'The server must deny environment-file paths.')
  report.status = 'passed'
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Verification failed.'
  process.exitCode = 1
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ status: report.status, public_url: report.public_url, checks: report.checks.length, error: report.error, report: output }))
