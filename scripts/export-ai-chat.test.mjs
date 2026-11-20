import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, unlinkSync, rmdirSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'

function exported(items) {
  const directory = mkdtempSync(join(tmpdir(), 'keymarket-transcript-'))
  const source = join(directory, 'source.jsonl')
  const output = join(directory, 'history.md')
  try {
    writeFileSync(source, items.map(payload => JSON.stringify({ type: 'response_item', timestamp: '2026-11-20T00:00:00Z', payload })).join('\n'))
    const result = spawnSync(process.execPath, [resolve('scripts/export-ai-chat.mjs'), source, output], { encoding: 'utf8' })
    if (result.status !== 0) return { status: result.status }
    return { status: result.status, text: readFileSync(output, 'utf8'), manifest: JSON.parse(readFileSync(join(directory, 'history.integrity.json'), 'utf8')) }
  } finally {
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name))
    rmdirSync(directory)
  }
}

const message = (role, text, phase) => ({ type: 'message', role, phase, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }] })

test('retains original user and assistant prose, questions, Unicode, fences and hashes', () => {
  const original = 'Original prompt\\\nPurple palette — `````literal fence`````'
  const result = exported([
    message('user', '<environment_context>generated metadata</environment_context>'),
    message('user', original), message('assistant', 'Progress text', 'commentary'),
    { type: 'function_call', name: 'request_user_input_async', arguments: JSON.stringify({ questions: [{ title: 'Public repository URL?' }] }) },
    message('assistant', 'Complete final response\nwith a second line.', 'final_answer'),
  ])
  assert.equal(result.status, 0)
  assert.ok(result.text.includes(original))
  assert.ok(result.text.includes('Complete final response\nwith a second line.'))
  assert.ok(result.text.includes('Public repository URL?'))
  assert.deepEqual(result.manifest.counts, { user_prompts_and_replies: 1, assistant_prose: 2, assistant_questions: 1, excluded_environment_messages: 1 })
  assert.equal(result.manifest.entries[0].original_sha256, createHash('sha256').update(original).digest('hex'))
  assert.ok(result.manifest.entries.every(entry => entry.original_sha256 === entry.exported_sha256))
})

test('redacts a credential without dropping its message and discloses the altered hash', () => {
  const credential = 'gh' + 'p_' + 'a'.repeat(36)
  const result = exported([message('assistant', 'Before ' + credential + ' after.', 'final_answer')])
  assert.equal(result.status, 0)
  assert.equal(result.manifest.exported_entries, 1)
  assert.equal(result.manifest.credential_redaction_occurrences, 1)
  assert.ok(result.text.includes('Before [REDACTED: credential] after.'))
  assert.equal(result.text.includes(credential), false)
  assert.notEqual(result.manifest.entries[0].original_sha256, result.manifest.entries[0].exported_sha256)
})

test('fails rather than silently omitting an unsupported message', () => {
  assert.notEqual(exported([{ type: 'message', role: 'user', content: [{ type: 'unsupported_attachment' }] }]).status, 0)
  assert.notEqual(exported([{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Preserve this attachment too.' }, { type: 'unsupported_attachment' }] }]).status, 0)
})

test('after-final mode captures an actual later final response from the persisted source', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'keymarket-transcript-tail-'))
  const source = join(directory, 'source.jsonl')
  const output = join(directory, 'history.md')
  writeFileSync(source, JSON.stringify({ type: 'response_item', payload: message('user', 'Original request') }) + '\n')
  const child = spawn(process.execPath, [resolve('scripts/export-ai-chat.mjs'), source, output, '--after-final'], { stdio: 'ignore' })
  try {
    const result = new Promise((accept, reject) => { child.once('error', reject); child.once('exit', accept) })
    await new Promise(accept => setTimeout(accept, 1000))
    appendFileSync(source, JSON.stringify({ type: 'response_item', payload: message('assistant', 'The actual final reply.', 'final_answer') }) + '\n')
    assert.equal(await result, 0)
    assert.ok(readFileSync(output, 'utf8').includes('The actual final reply.'))
    assert.equal(JSON.parse(readFileSync(join(directory, 'history.integrity.json'), 'utf8')).exported_entries, 2)
  } finally {
    child.kill()
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name))
    rmdirSync(directory)
  }
})
