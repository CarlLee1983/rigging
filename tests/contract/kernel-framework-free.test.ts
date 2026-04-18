import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN_IMPORTS = [
  'elysia',
  'drizzle-orm',
  'better-auth',
  'postgres',
  'pino',
  '@bogeychan/elysia-logger',
]

describe('shared/kernel remains framework-free', () => {
  test('no forbidden imports appear in kernel source files', () => {
    const dir = 'src/shared/kernel'
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'))

    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8')
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(text).not.toMatch(new RegExp(`from ['"]${forbidden}['"]`))
      }
    }
  })
})
