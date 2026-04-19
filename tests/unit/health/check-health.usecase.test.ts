import { describe, expect, test } from 'bun:test'
import type { IDbHealthProbe } from '../../../src/health/application/ports/db-health-probe.port'
import { CheckHealthUseCase } from '../../../src/health/application/usecases/check-health.usecase'

const fixedClock = { now: () => new Date('2026-04-19T12:00:00.000Z') }

describe('CheckHealthUseCase', () => {
  test('DB up → ok:true, db:"up", checkedAt:ISO', async () => {
    const probe: IDbHealthProbe = { probe: () => Promise.resolve('up') }
    const usecase = new CheckHealthUseCase(probe, fixedClock)
    const result = await usecase.execute()
    expect(result).toEqual({
      ok: true,
      db: 'up',
      checkedAt: '2026-04-19T12:00:00.000Z',
    })
  })

  test('DB down (probe resolves "down") → ok:false, db:"down"', async () => {
    const probe: IDbHealthProbe = { probe: () => Promise.resolve('down') }
    const usecase = new CheckHealthUseCase(probe, fixedClock)
    const result = await usecase.execute()
    expect(result).toEqual({
      ok: false,
      db: 'down',
      checkedAt: '2026-04-19T12:00:00.000Z',
    })
  })

  test('probe rejection propagates (controller, not use case, is responsible for 503)', async () => {
    const probe: IDbHealthProbe = {
      probe: () => Promise.reject(new Error('conn refused')),
    }
    const usecase = new CheckHealthUseCase(probe, fixedClock)
    await expect(usecase.execute()).rejects.toThrow('conn refused')
  })
})
