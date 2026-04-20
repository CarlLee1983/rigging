#!/usr/bin/env bun
/**
 * validate-adr-frontmatter.ts — MADR front matter gate for docs/decisions/*.md (Phase 08-01)
 *
 * Validates leading YAML block and first title line. Exits 1 with ::error:: on stderr (GitHub Actions).
 */
import { readFileSync } from 'node:fs'

const REQUIRED_KEYS = ['status', 'date', 'deciders', 'consulted', 'informed'] as const
const TITLE_RE = /^#\s*\d{4}\.\s+\S/

function fail(message: string): never {
  console.error(`::error::${message}`)
  process.exit(1)
}

function parseFrontMatter(raw: string): { yaml: string; body: string } | null {
  if (!raw.startsWith('---\n')) return null
  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return null
  return { yaml: raw.slice(4, end), body: raw.slice(end + 5) }
}

function parseYamlKeys(yaml: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of yaml.split('\n')) {
    const t = line.trimEnd()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf(':')
    if (idx <= 0) continue
    const key = t.slice(0, idx).trim()
    const val = t.slice(idx + 1).trim()
    out[key] = val
  }
  return out
}

function firstTitleLine(body: string): string | null {
  for (const line of body.split('\n')) {
    if (line.trim() === '') continue
    return line
  }
  return null
}

function validateFile(path: string): void {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    fail(`${path}: cannot read file`)
  }

  const parsed = parseFrontMatter(raw)
  if (!parsed) {
    fail(`${path}: missing leading --- YAML block closed by ---`)
  }

  const keys = parseYamlKeys(parsed.yaml)
  for (const k of REQUIRED_KEYS) {
    const v = keys[k]
    if (v === undefined || v.length === 0) {
      fail(`${path}: front matter must include non-empty string key "${k}"`)
    }
  }

  const title = firstTitleLine(parsed.body)
  if (!title || !TITLE_RE.test(title)) {
    fail(
      `${path}: first non-empty line after front matter must match MADR title pattern (e.g. "# 0019. Title")`,
    )
  }
}

const paths = process.argv.slice(2).filter((a) => a.length > 0)
if (paths.length === 0) {
  fail('usage: validate-adr-frontmatter.ts <path> [path...]')
}

for (const p of paths) {
  validateFile(p)
}

process.exit(0)
