import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import type { IDbHealthProbe } from '../../../src/health/application/ports/db-health-probe.port'
import { CheckHealthUseCase } from '../../../src/health/application/usecases/check-health.usecase'
import { healthController } from '../../../src/health/presentation/controllers/health.controller'

const fixedClock = { now: () => new Date('2026-04-19T12:00:00.000Z') }

function mountController(probe: IDbHealthProbe) {
  const checkHealth = new CheckHealthUseCase(probe, fixedClock)
  return new Elysia().use(healthController({ checkHealth }))
}

describe('healthController', () => {
  test('DB up → 200 + { ok:true, db:"up", checkedAt:ISO }', async () => {
    const app = mountController({ probe: () => Promise.resolve('up') })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; db: string; checkedAt: string }
    expect(body).toEqual({
      ok: true,
      db: 'up',
      checkedAt: '2026-04-19T12:00:00.000Z',
    })
  })

  test('DB down (probe returns "down") → 503 + ok:false, db:"down"', async () => {
    const app = mountController({ probe: () => Promise.resolve('down') })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; db: string }
    expect(body.ok).toBe(false)
    expect(body.db).toBe('down')
  })

  test('probe rejection → 503 (controller try/catch; global error handler NOT involved)', async () => {
    const app = mountController({
      probe: () => Promise.reject(new Error('conn refused')),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; db: string; checkedAt: string }
    expect(body.ok).toBe(false)
    expect(body.db).toBe('down')
    expect(typeof body.checkedAt).toBe('string')
    // ISO-8601 shape
    expect(body.checkedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
  })
})
