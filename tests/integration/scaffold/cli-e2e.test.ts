import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { execSync } from 'child_process'
import { existsSync, readFileSync, rmSync } from 'fs'
import path from 'path'

// Repo root: tests/integration/scaffold/ → three levels up
const REPO_ROOT = path.join(import.meta.dir, '../../..')
const PROJECT_NAME = 'test-scaffold-output'
const DEST = path.join(REPO_ROOT, PROJECT_NAME)

describe('create-rigging CLI (integration)', () => {
  let cliStdout = ''

  beforeAll(() => {
    // Clean up any leftover from previous runs (idempotent)
    if (existsSync(DEST)) {
      rmSync(DEST, { recursive: true, force: true })
    }

    // RESEARCH Pitfall 2: template must be built before running CLI
    execSync('node scripts/build-template.js', { cwd: REPO_ROOT, stdio: 'pipe' })

    // Run CLI and capture stdout for SCAF-07 assertion
    const result = execSync(
      `node packages/create-rigging/bin/create-rigging.js ${PROJECT_NAME}`,
      { cwd: REPO_ROOT }
    )
    cliStdout = result.toString()
  })

  afterAll(() => {
    // Clean up generated directory regardless of test outcome
    if (existsSync(DEST)) {
      rmSync(DEST, { recursive: true, force: true })
    }
  })

  // SCAF-01: CLI creates the destination directory
  test('SCAF-01: output directory exists', () => {
    expect(existsSync(DEST)).toBe(true)
  })

  // SCAF-03: Full project structure present
  describe('SCAF-03: generated project contains full reference app structure', () => {
    test('src/ directory exists', () => {
      expect(existsSync(path.join(DEST, 'src'))).toBe(true)
    })

    test('tests/ directory exists', () => {
      expect(existsSync(path.join(DEST, 'tests'))).toBe(true)
    })

    test('drizzle/ directory exists (migration files)', () => {
      expect(existsSync(path.join(DEST, 'drizzle'))).toBe(true)
    })

    test('.github/workflows/ directory exists (CI)', () => {
      expect(existsSync(path.join(DEST, '.github', 'workflows'))).toBe(true)
    })

    test('docker-compose.yml exists', () => {
      expect(existsSync(path.join(DEST, 'docker-compose.yml'))).toBe(true)
    })

    test('tsconfig.json exists', () => {
      expect(existsSync(path.join(DEST, 'tsconfig.json'))).toBe(true)
    })

    test('bun.lock exists (D-11: included for reproducibility)', () => {
      expect(existsSync(path.join(DEST, 'bun.lock'))).toBe(true)
    })
  })

  // SCAF-04: Project name substituted throughout
  describe('SCAF-04: project name substituted correctly', () => {
    test('package.json name is substituted', () => {
      const pkg = JSON.parse(readFileSync(path.join(DEST, 'package.json'), 'utf8')) as { name: string }
      expect(pkg.name).toBe(PROJECT_NAME)
      expect(pkg.name).not.toContain('rigging')
    })

    test('docker-compose.yml contains project name not "rigging"', () => {
      const content = readFileSync(path.join(DEST, 'docker-compose.yml'), 'utf8')
      expect(content).toContain(PROJECT_NAME)
      expect(content).not.toContain('rigging')
    })

    test('bun.lock is NOT substituted (binary-like, D-09: copied verbatim)', () => {
      // bun.lock should contain 'rigging' (unchanged) because it's not in TEXT_EXTENSIONS
      const content = readFileSync(path.join(DEST, 'bun.lock'), 'utf8')
      // bun.lock references the package name — it will still say "rigging" because it's copied verbatim
      // This is expected behaviour (D-09): lock file is treated as binary/non-substitutable
      expect(content).toContain('rigging')
    })
  })

  // SCAF-05: Planning and scaffold-internal files excluded
  describe('SCAF-05: planning and scaffold-internal files excluded', () => {
    test('.planning/ is absent from generated output', () => {
      expect(existsSync(path.join(DEST, '.planning'))).toBe(false)
    })

    test('packages/ is absent from generated output', () => {
      expect(existsSync(path.join(DEST, 'packages'))).toBe(false)
    })

    test('.git/ is absent from generated output', () => {
      expect(existsSync(path.join(DEST, '.git'))).toBe(false)
    })

    test('.env (secrets) is absent from generated output', () => {
      // Only .env.example should be present, not the actual .env with secrets
      expect(existsSync(path.join(DEST, '.env'))).toBe(false)
    })
  })

  // SCAF-06: .env.example present with all required variables documented
  describe('SCAF-06: .env.example with required environment variables', () => {
    test('.env.example exists', () => {
      expect(existsSync(path.join(DEST, '.env.example'))).toBe(true)
    })

    test('.env.example contains DATABASE_URL', () => {
      const content = readFileSync(path.join(DEST, '.env.example'), 'utf8')
      expect(content).toContain('DATABASE_URL')
    })

    test('.env.example contains BETTER_AUTH_SECRET', () => {
      const content = readFileSync(path.join(DEST, '.env.example'), 'utf8')
      expect(content).toContain('BETTER_AUTH_SECRET')
    })

    test('.env.example contains PORT', () => {
      const content = readFileSync(path.join(DEST, '.env.example'), 'utf8')
      expect(content).toContain('PORT')
    })
  })

  // SCAF-07: next-steps guidance printed to stdout
  describe('SCAF-07: CLI prints next-steps guidance', () => {
    test('stdout contains "cd test-scaffold-output"', () => {
      expect(cliStdout).toContain(`cd ${PROJECT_NAME}`)
    })

    test('stdout contains "bun install"', () => {
      expect(cliStdout).toContain('bun install')
    })

    test('stdout contains "docker compose up -d"', () => {
      expect(cliStdout).toContain('docker compose up -d')
    })

    test('stdout contains "bun test"', () => {
      expect(cliStdout).toContain('bun test')
    })
  })
})
