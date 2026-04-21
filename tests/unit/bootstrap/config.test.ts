import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { loadConfig } from '@/bootstrap/config'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: '3000',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
}

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(VALID_ENV)
  const saved: Record<string, string | undefined> = {}

  for (const key of [...keys, ...Object.keys(patch)]) {
    saved[key] = process.env[key]
  }

  try {
    for (const key of keys) {
      process.env[key] = VALID_ENV[key as keyof typeof VALID_ENV]
    }

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    fn()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

describe('loadConfig', () => {
  test('returns typed config when all env vars are valid', () => {
    withEnv({}, () => {
      const config = loadConfig()

      expect(config.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL)
      expect(config.BETTER_AUTH_SECRET).toBe(VALID_ENV.BETTER_AUTH_SECRET)
      expect(config.BETTER_AUTH_URL).toBe(VALID_ENV.BETTER_AUTH_URL)
      expect(config.PORT).toBe(3000)
      expect(config.NODE_ENV).toBe('test')
      expect(config.LOG_LEVEL).toBe('info')
    })
  })

  test('throws when BETTER_AUTH_SECRET is missing', () => {
    withEnv({ BETTER_AUTH_SECRET: undefined }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when BETTER_AUTH_SECRET is shorter than 32 chars', () => {
    withEnv({ BETTER_AUTH_SECRET: 'too-short' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when DATABASE_URL is not postgresql://', () => {
    withEnv({ DATABASE_URL: 'mysql://bad' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when PORT is non-numeric', () => {
    withEnv({ PORT: 'nope' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when PORT is out of range', () => {
    withEnv({ PORT: '70000' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when NODE_ENV is invalid', () => {
    withEnv({ NODE_ENV: 'staging' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })

  test('throws when LOG_LEVEL is invalid', () => {
    withEnv({ LOG_LEVEL: 'verbose' }, () => {
      expect(() => loadConfig()).toThrow(/Invalid environment variables/)
    })
  })
})

describe('loadConfig optional Resend fields', () => {
  test('RESEND_API_KEY and RESEND_FROM_ADDRESS default to undefined when not set', () => {
    withEnv({ RESEND_API_KEY: undefined, RESEND_FROM_ADDRESS: undefined }, () => {
      const config = loadConfig()
      expect(config.RESEND_API_KEY).toBeUndefined()
      expect(config.RESEND_FROM_ADDRESS).toBeUndefined()
    })
  })

  test('RESEND_API_KEY is present when set', () => {
    withEnv({ RESEND_API_KEY: 're_test_abc123', RESEND_FROM_ADDRESS: undefined }, () => {
      const config = loadConfig()
      expect(config.RESEND_API_KEY).toBe('re_test_abc123')
    })
  })

  test('RESEND_FROM_ADDRESS is present when set to a valid email', () => {
    withEnv({ RESEND_FROM_ADDRESS: 'noreply@example.com', RESEND_API_KEY: undefined }, () => {
      const config = loadConfig()
      expect(config.RESEND_FROM_ADDRESS).toBe('noreply@example.com')
    })
  })
})

describe('Config contract drift guard', () => {
  test('.env.example keys match ConfigSchema keys exactly', () => {
    const envText = readFileSync('.env.example', 'utf8')
    const exampleKeys = new Set<string>()

    for (const line of envText.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=/)
      if (match?.[1]) {
        exampleKeys.add(match[1])
      }
    }

    const schemaKeys = new Set([
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'PORT',
      'NODE_ENV',
      'LOG_LEVEL',
      'RESEND_API_KEY',
      'RESEND_FROM_ADDRESS',
    ])

    for (const key of schemaKeys) {
      expect(exampleKeys.has(key)).toBe(true)
    }

    for (const key of exampleKeys) {
      expect(schemaKeys.has(key)).toBe(true)
    }
  })
})
