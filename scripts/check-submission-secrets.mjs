import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const patterns = [
  ['private-key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/g],
  ['aws-access-key', /\bAKIA[A-Z0-9]{16}\b/g],
  ['embedded-laravel-key', /base64:[A-Za-z0-9+/]{42,}={0,2}/g],
  ['database-password', /^(?:\s*(?:DB_PASSWORD|POSTGRES_PASSWORD)\s*[:=]\s*)["']?([A-Za-z0-9!@#%^&*+._-]{4,})["']?\s*$/gm],
]

export function inspectText(text, knownSecrets = []) {
  const findings = []
  for (const [rule, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      findings.push({ rule, line: text.slice(0, match.index).split('\n').length })
    }
  }
  for (const secret of knownSecrets) {
    const index = text.indexOf(secret)
    if (index >= 0) findings.push({ rule: 'local-secret-value', line: text.slice(0, index).split('\n').length })
  }
  return findings
}

function localSecrets(root) {
  const values = new Set()
  for (const name of ['.env', '.env.production', 'backend/.env', 'backend/.env.production']) {
    let content
    try { content = readFileSync(resolve(root, name), 'utf8') } catch { continue }
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]*(?:KEY|SECRET|PASSWORD|TOKEN|DB_URL))=(.*)$/)
      if (!match) continue
      const value = match[2].trim().replace(/^(["'])(.*)\1$/, '$2')
      if (value.length >= 16 && !value.includes('${')) values.add(value)
    }
  }
  return [...values]
}

export function scanRepository(root) {
  const names = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))]
  const known = localSecrets(root)
  const findings = []
  let scanned = 0
  for (const path of names) {
    if (/(?:^|\/)(?:\.env(?:\.(?!example$|production\.example$).*)?|id_rsa|id_ed25519)$|\.(?:pem|p12|pfx|key)$/i.test(path)) {
      findings.push({ path, rule: 'private-file', line: 1 })
    }
    let bytes
    try { bytes = readFileSync(resolve(root, path)) } catch { continue }
    if (bytes.includes(0)) continue
    scanned++
    for (const finding of inspectText(bytes.toString('utf8'), known)) findings.push({ path, ...finding })
  }
  return { scanned_text_files: scanned, findings, scope: 'Git-tracked and nonignored untracked working-tree files; known local secret values of at least 16 characters; no secret values in output.' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = scanRepository(process.cwd())
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.findings.length ? 1 : 0
}
