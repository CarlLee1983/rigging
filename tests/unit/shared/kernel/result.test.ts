import { describe, expect, test } from 'bun:test'
import { err, isErr, isOk, ok, type Result } from '@/shared/kernel/result'

describe('Result: ok factory', () => {
  test('returns Ok with value', () => {
    const r = ok(42)
    expect(r.isOk()).toBe(true)
    expect(r.isErr()).toBe(false)
    if (r.isOk()) expect(r.value).toBe(42)
  })
})

describe('Result: err factory', () => {
  test('returns Err with error', () => {
    const r = err<never, string>('boom')
    expect(r.isErr()).toBe(true)
    expect(r.isOk()).toBe(false)
    if (r.isErr()) expect(r.error).toBe('boom')
  })
})

describe('Result.map', () => {
  test('Ok: applies fn', () => {
    const r = ok<number, string>(1).map((value) => value + 1)
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value).toBe(2)
  })

  test('Err: passthrough', () => {
    const r: Result<number, string> = err('e')
    const mapped = r.map((value) => value + 1)
    expect(mapped.isErr()).toBe(true)
    if (mapped.isErr()) expect(mapped.error).toBe('e')
  })
})

describe('Result.mapErr', () => {
  test('Ok: passthrough', () => {
    const r: Result<number, string> = ok(1)
    const mapped = r.mapErr((error) => `wrapped: ${error}`)
    expect(mapped.isOk()).toBe(true)
  })

  test('Err: applies fn', () => {
    const r: Result<number, string> = err('e')
    const mapped = r.mapErr((error) => `wrapped: ${error}`)
    if (mapped.isErr()) expect(mapped.error).toBe('wrapped: e')
  })
})

describe('Result.andThen', () => {
  test('Ok -> Ok chain', () => {
    const r = ok<number, string>(1).andThen((value) => ok<number, string>(value * 2))
    if (r.isOk()) expect(r.value).toBe(2)
  })

  test('Ok -> Err chain', () => {
    const r = ok<number, string>(1).andThen(() => err<number, string>('bad'))
    if (r.isErr()) expect(r.error).toBe('bad')
  })

  test('Err short-circuits', () => {
    const r: Result<number, string> = err('e')
    const chained = r.andThen((value) => ok<number, string>(value * 2))
    if (chained.isErr()) expect(chained.error).toBe('e')
  })
})

describe('Result.match', () => {
  test('Ok: calls ok handler', () => {
    const result = ok<number, string>(1).match({
      ok: (value) => `v=${value}`,
      err: (error) => `e=${error}`,
    })
    expect(result).toBe('v=1')
  })

  test('Err: calls err handler', () => {
    const result = err<number, string>('boom').match({
      ok: (value) => `v=${value}`,
      err: (error) => `e=${error}`,
    })
    expect(result).toBe('e=boom')
  })
})

describe('Result: type guards isOk / isErr', () => {
  test('narrow Ok', () => {
    const r: Result<number, string> = ok(1)
    expect(isOk(r)).toBe(true)
    expect(isErr(r)).toBe(false)
  })

  test('narrow Err', () => {
    const r: Result<number, string> = err('e')
    expect(isErr(r)).toBe(true)
    expect(isOk(r)).toBe(false)
  })
})
