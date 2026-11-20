import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectText } from './check-submission-secrets.mjs'

test('reports credential locations without returning their values', () => {
  const credential = 'generated-' + 'a'.repeat(32)
  const findings = inspectText('heading\nDB_PASSWORD=' + credential)
  assert.deepEqual(findings, [{ rule: 'database-password', line: 2 }])
  assert.equal(JSON.stringify(findings).includes(credential), false)
})

test('detects private keys, provider tokens, encryption keys and actual local secrets', () => {
  for (const value of [
    '-'.repeat(5) + 'BEGIN PRIVATE KEY' + '-'.repeat(5),
    'gh' + 'p_' + 'a'.repeat(36),
    's' + 'k-proj-' + 'x'.repeat(40),
    'base64:' + 'a'.repeat(43) + '=',
  ]) assert.ok(inspectText(value).length > 0)
  assert.deepEqual(inspectText('example accidental value', ['accidental value']), [{ rule: 'local-secret-value', line: 1 }])
})

test('accepts blank environment templates and runtime-generated values', () => {
  assert.deepEqual(inspectText('APP_KEY=\nDB_PASSWORD=\nPOSTGRES_PASSWORD: ${DB_PASSWORD:?Set it locally}\n'), [])
})
