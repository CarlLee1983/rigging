import { describe, expect, test } from 'bun:test'
import { DrizzleDbHealthProbe } from '../../../src/health/infrastructure/drizzle-db-health-probe'

// Minimal fake matching the `Pick<DrizzleDb, 'execute'>` shape the adapter accepts.
// We do NOT instantiate a real Drizzle connection — this is a unit test of the adapter's
// error-handling + timeout contract, not an integration test of Drizzle.
type FakeDb = { execute: (query: unknown) => Promise<unknown> }

describe('DrizzleDbHealthProbe', () => {
  test('A: probe resolves "up" when db.execute resolves', async () => {
    const fakeDb: FakeDb = { execute: () => Promise.resolve([{ ok: 1 }]) }
    const probe = new DrizzleDbHealthProbe(fakeDb as never)
    const result = await probe.probe()
    expect(result).toBe('up')
  })

  test('B: probe resolves "down" (does NOT throw) when db.execute rejects', async () => {
    const fakeDb: FakeDb = {
      execute: () => Promise.reject(new Error('conn refused')),
    }
    const probe = new DrizzleDbHealthProbe(fakeDb as never)
    // If the adapter re-throws, the test fails with the thrown error rather than asserting 'down'.
    const result = await probe.probe()
    expect(result).toBe('down')
  })

  test('C: probe resolves "down" within ~150ms when db.execute never resolves (AbortController timeout)', async () => {
    const fakeDb: FakeDb = {
      execute: () => new Promise(() => {}), // never resolves, never rejects
    }
    const probe = new DrizzleDbHealthProbe(fakeDb as never, 50) // 50ms timeout
    const started = performance.now()
    const result = await probe.probe()
    const elapsedMs = performance.now() - started
    expect(result).toBe('down')
    // Generous upper bound accounting for CI scheduler jitter; hang would be >= 2000ms (default) or never.
    expect(elapsedMs).toBeLessThan(500)
  })
})
