import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve('.')
const schemaGlob = join(repoRoot, 'src/auth/infrastructure/schema/*.ts')

describe('drizzle schema drift contract', () => {
  test('drizzle-kit check reports a clean schema when migration and tables match', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'rigging-drizzle-'))
    const outDir = join(tempRoot, 'drizzle')
    mkdirSync(outDir, { recursive: true })

    const configPath = join(tempRoot, 'drizzle.config.ts')
    const drizzleKitEntry = join(repoRoot, 'node_modules/drizzle-kit')
    writeFileSync(
      configPath,
      `const { defineConfig } = require(${JSON.stringify(drizzleKitEntry)})\n\nmodule.exports = defineConfig({\n  dialect: 'postgresql',\n  schema: ${JSON.stringify(schemaGlob)},\n  out: ${JSON.stringify(outDir)},\n  dbCredentials: { url: 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging' },\n  verbose: false,\n  strict: true,\n})\n`,
    )

    try {
      const output = execFileSync('bunx', ['drizzle-kit', 'check', '--config', configPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging',
        },
      })

      expect(output).toContain("Everything's fine")
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
