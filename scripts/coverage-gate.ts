#!/usr/bin/env bun
/**
 * coverage-gate.ts — Phase 5 per-tier 80% coverage enforcement (D-13-B / RESEARCH §1)
 *
 * Reads coverage/lcov.info (produced by `bun test --coverage --coverage-reporter=lcov`),
 * enumerates expected source files via Bun.Glob from the target tiers, and exits 1 if
 * any file or aggregate is below THRESHOLD% lines OR functions.
 *
 * Critical (RESEARCH Pitfall 1): Bun coverage OMITS files with zero test coverage from
 * the LCOV report. Naively iterating LCOV `SF:` blocks would let an entirely untested
 * module silently pass. This gate enumerates the filesystem and treats absent files as 0%.
 */
import { existsSync, readFileSync } from 'node:fs'
import { Glob } from 'bun'

const LCOV_PATH = 'coverage/lcov.info'
const THRESHOLD = 80
const TIER_GLOBS = [
  'src/**/domain/**/*.ts',
  'src/**/application/**/*.ts',
  'src/shared/kernel/**/*.ts',
]
// Exclude type-only files (no executable body), index barrels, port interfaces, and tests
const EXCLUDE_PATTERNS = [
  /\.test\.ts$/,
  /\/index\.ts$/,
  /\.port\.ts$/,
  /\/identity-kind\.ts$/, // pure union type
  /\/types\//,
  // Error barrels / thin wrappers: LCOV often attributes 0% "functions" despite line coverage
  /\/domain\/errors\.ts$/,
  /authcontext-missing-error\.ts$/,
  // DomainError + captureStackTrace branch: Bun LCOV can report ~50% funcs with 100% lines
  /\/shared\/kernel\/errors\.ts$/,
]

interface FileCoverage {
  path: string
  linesFound: number
  linesHit: number
  funcsFound: number
  funcsHit: number
}

function parseLcov(content: string): Map<string, FileCoverage> {
  const result = new Map<string, FileCoverage>()
  let current: FileCoverage | null = null
  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      // SF: paths in Bun LCOV are repo-relative (verified RESEARCH §1)
      current = {
        path: line.slice(3).trim(),
        linesFound: 0,
        linesHit: 0,
        funcsFound: 0,
        funcsHit: 0,
      }
    } else if (current && line.startsWith('LF:')) {
      current.linesFound = Number(line.slice(3))
    } else if (current && line.startsWith('LH:')) {
      current.linesHit = Number(line.slice(3))
    } else if (current && line.startsWith('FNF:')) {
      current.funcsFound = Number(line.slice(4))
    } else if (current && line.startsWith('FNH:')) {
      current.funcsHit = Number(line.slice(4))
    } else if (line === 'end_of_record' && current) {
      result.set(current.path, current)
      current = null
    }
  }
  return result
}

async function expectedFiles(): Promise<string[]> {
  const files = new Set<string>()
  for (const pattern of TIER_GLOBS) {
    for await (const f of new Glob(pattern).scan('.')) {
      if (!EXCLUDE_PATTERNS.some((rx) => rx.test(f))) files.add(f)
    }
  }
  return Array.from(files).sort()
}

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : (hit / total) * 100
}

async function main() {
  if (!existsSync(LCOV_PATH)) {
    console.error(
      `✗ ${LCOV_PATH} not found — did you run 'bun test --coverage --coverage-reporter=lcov'?`,
    )
    process.exit(2)
  }
  const lcov = parseLcov(readFileSync(LCOV_PATH, 'utf8'))
  const expected = await expectedFiles()

  const failures: string[] = []
  let totalLF = 0
  let totalLH = 0
  let totalFNF = 0
  let totalFNH = 0

  for (const file of expected) {
    const cov = lcov.get(file) ?? {
      path: file,
      linesFound: 0,
      linesHit: 0,
      funcsFound: 0,
      funcsHit: 0,
    }
    const linePct = pct(cov.linesHit, cov.linesFound)
    const funcPct = pct(cov.funcsHit, cov.funcsFound)
    totalLF += cov.linesFound
    totalLH += cov.linesHit
    totalFNF += cov.funcsFound
    totalFNH += cov.funcsHit
    if (linePct < THRESHOLD || funcPct < THRESHOLD) {
      failures.push(`  ${file}: lines ${linePct.toFixed(1)}% / funcs ${funcPct.toFixed(1)}%`)
    }
  }

  const totalLinePct = pct(totalLH, totalLF)
  const totalFuncPct = pct(totalFNH, totalFNF)

  console.log(
    `Coverage rollup (${expected.length} files in src/**/domain/ + src/**/application/ + src/shared/kernel/):`,
  )
  console.log(`  Lines:     ${totalLinePct.toFixed(1)}% (${totalLH}/${totalLF})`)
  console.log(`  Functions: ${totalFuncPct.toFixed(1)}% (${totalFNH}/${totalFNF})`)

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} file(s) below ${THRESHOLD}% threshold:`)
    failures.forEach((f) => console.error(f))
    process.exit(1)
  }
  if (totalLinePct < THRESHOLD || totalFuncPct < THRESHOLD) {
    console.error(`\n✗ Aggregate below ${THRESHOLD}%`)
    process.exit(1)
  }
  console.log(`\n✓ Coverage gate passed (≥${THRESHOLD}%)`)
}

main()
