import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'

type Case = {
  file: string
  tokens: string[]
}

function runBiome(file: string) {
  const proc = spawnSync('bunx', ['biome', 'check', '--vcs-use-ignore-file=false', file], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
    },
  })

  return {
    exitCode: proc.status ?? -1,
    output: `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`,
  }
}

const CASES: Case[] = [
  {
    file: 'tests/biome-contract/domain/drizzle-violation.ts',
    tokens: ['Move Drizzle usage to src/{feature}/infrastructure/'],
  },
  {
    file: 'tests/biome-contract/domain/elysia-violation.ts',
    tokens: ['HTTP concerns belong in src/{feature}/presentation/'],
  },
  {
    file: 'tests/biome-contract/domain/better-auth-violation.ts',
    tokens: ['IIdentityService port'],
  },
  {
    file: 'tests/biome-contract/domain/postgres-violation.ts',
    tokens: ['src/shared/infrastructure/db/client.ts'],
  },
  {
    file: 'tests/biome-contract/domain/logger-violation.ts',
    tokens: ['ILogger from src/shared/application/ports/'],
  },
  {
    file: 'tests/biome-contract/application/drizzle-violation.ts',
    tokens: ['Repository port in this feature'],
  },
  {
    file: 'tests/biome-contract/application/postgres-violation.ts',
    tokens: ['Inject the port defined in application/ports/'],
  },
  {
    file: 'tests/biome-contract/application/internal-barrel-violation.ts',
    tokens: ['Only the domain/index.ts barrel', 'getXxxService(ctx) factory'],
  },
  {
    file: 'tests/biome-contract/presentation/internal-barrel-violation.ts',
    tokens: ['Only the domain/index.ts barrel'],
  },
]

describe('Biome rule contract: restricted imports are blocked', () => {
  for (const { file, tokens } of CASES) {
    test(`biome check ${file} exits non-zero`, () => {
      const { exitCode, output } = runBiome(file)
      expect(exitCode).not.toBe(0)
      for (const token of tokens) {
        expect(output).toContain(token)
      }
    })
  }
})
