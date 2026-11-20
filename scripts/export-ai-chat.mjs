import { createReadStream, writeFileSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const source = process.argv[2]
if (!source) {
  console.error('Usage: node scripts/export-ai-chat.mjs PRIVATE_ROLLOUT_JSONL [OUTPUT_MARKDOWN]')
  process.exit(1)
}
const output = resolve(process.argv[3] ?? 'docs/ai-chat-history.md')
if (process.argv.includes('--after-final')) {
  let offset = statSync(source).size
  let partial = ''
  await new Promise((accept, reject) => {
    const timeout = setTimeout(() => { clearInterval(interval); reject(new Error('No new final response appeared within five minutes. Run the export again manually.')) }, 300_000)
    const interval = setInterval(() => {
      const size = statSync(source).size
      if (size <= offset) return
      const file = openSync(source, 'r')
      let bytes
      try {
        bytes = Buffer.alloc(size - offset)
        const count = readSync(file, bytes, 0, bytes.length, offset)
        offset += count
        bytes = bytes.subarray(0, count)
      } finally { closeSync(file) }
      const lines = (partial + bytes.toString('utf8')).split('\n')
      partial = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        const item = event.payload ?? {}
        if (event.type === 'response_item' && item.type === 'message' && item.role === 'assistant' && ['final_answer', 'final'].includes(item.phase)) {
          clearInterval(interval)
          clearTimeout(timeout)
          accept()
          return
        }
      }
    }, 500)
  })
}
const known = new Set(['Demo' + 'Pass!2027'])
for (const path of ['backend/.env', '.env', '.env.production']) {
  let content
  try { content = readFileSync(path, 'utf8') } catch { continue }
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^(APP_KEY|KEY_FINGERPRINT_SECRET|DB_URL|DB_PASSWORD|[A-Z_]*(?:API_KEY|ACCESS_TOKEN|PRIVATE_KEY))=(.+)$/)
    if (match) known.add(match[2].replace(/^(["'])(.*)\1$/, '$2'))
  }
}

let redactions = 0
function sanitize(original) {
  let text = original
  for (const value of known) {
    if (!value || value.length < 12) continue
    text = text.replaceAll(value, () => { redactions++; return '[REDACTED: credential]' })
  }
  text = text.replace(/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,})\b/g,
    () => { redactions++; return '[REDACTED: credential]' })
  text = text.replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
    () => { redactions++; return '[REDACTED: private key]' })
  return text
}

const entries = []
const integrity = []
const counts = { user_prompts_and_replies: 0, assistant_prose: 0, assistant_questions: 0, excluded_environment_messages: 0 }
for await (const line of createInterface({ input: createReadStream(source), crlfDelay: Infinity })) {
  if (!line.trim()) continue
  const event = JSON.parse(line)
  const item = event.payload ?? {}
  if (event.type !== 'response_item') continue
  let messages = []
  let role
  if (item.type === 'message' && ['user', 'assistant'].includes(item.role)) {
    if (item.role === 'assistant' && !['commentary', 'final_answer', 'final'].includes(item.phase)) continue
    if ((item.content ?? []).some(block => !['input_text', 'output_text', 'text'].includes(block.type))) {
      throw new Error('A conversation message has unsupported blocks; inspect the source before exporting.')
    }
    const blocks = item.content ?? []
    if (!blocks.length) throw new Error('A conversation message has no supported text blocks; inspect the source before exporting.')
    messages = blocks.map(block => block.text)
    if (item.role === 'user' && messages[0].startsWith('<environment_context>')) { counts.excluded_environment_messages++; continue }
    role = item.role === 'user' ? 'User' : 'Assistant ' + (item.phase === 'commentary' ? 'progress update' : 'final response')
    counts[item.role === 'user' ? 'user_prompts_and_replies' : 'assistant_prose']++
  } else if (['function_call', 'custom_tool_call'].includes(item.type) && item.name === 'request_user_input_async') {
    const argumentsValue = JSON.parse(item.arguments ?? item.input)
    messages = argumentsValue.questions.map(question => question.title)
    role = 'Assistant question'
    counts.assistant_questions += messages.length
  } else continue
  for (const original of messages) {
    const text = sanitize(original)
    const fence = '`'.repeat(Math.max(4, ...[...text.matchAll(/`+/g)].map(match => match[0].length + 1)))
    entries.push(`## ${entries.length + 1} ${role}\n\n${fence}text\n${text}\n${fence}\n`)
    integrity.push({ ordinal: entries.length, role, source_timestamp: event.timestamp, source_id: item.id ?? item.call_id ?? null,
      original_sha256: createHash('sha256').update(original).digest('hex'), exported_sha256: createHash('sha256').update(text).digest('hex'), credential_redacted: text !== original })
  }
}

const fidelity = redactions
  ? `Credential-only redactions are explicitly marked. This submission copy is **not byte-identical** to the unredacted original. ${redactions} credential occurrence(s) were removed; no conversation entries were omitted for that reason.`
  : 'No credential redactions were required for this export. Every included message body matches its original text exactly.'
const header = `# AI conversation history\n\nExported directly from this project's local Codex session log. All original user-authored prompts and replies, assistant progress messages, final responses and tool-presented clarification questions available in that log are retained in source order. Message bodies are not summarized or reconstructed.\n\n${fidelity} Message hashes and coverage are in [ai-chat-history.integrity.json](ai-chat-history.integrity.json).\n\nAutomatically supplied environment metadata, private system/developer instructions, internal reasoning and tool execution transport/results are excluded. This is a complete export of human conversation prose available at export time, not a raw execution log. The source session log remains private outside the repository. See [export and security instructions](submission-security.md). The active turn can be refreshed after its final response using the export command there.\n\n`
writeFileSync(output, header + entries.join('\n'), 'utf8')
writeFileSync(output.replace(/\.md$/, '.integrity.json'), JSON.stringify({ source: 'Local project Codex session JSONL; source path intentionally private', exported_at: new Date().toISOString(), counts, exported_entries: entries.length, credential_redaction_occurrences: redactions, entries: integrity }, null, 2) + '\n')
console.log(JSON.stringify({ output, counts, exported_entries: entries.length, credential_redaction_occurrences: redactions }))
