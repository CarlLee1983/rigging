import { describe, expect, test } from 'bun:test'
import { type Brand, brand } from '@/shared/kernel/brand'

type UserId = Brand<string, 'UserId'>
type OrderId = Brand<string, 'OrderId'>

describe('Brand: runtime value identity', () => {
  test('brand() is zero-cost (returns the same primitive)', () => {
    const raw = 'abc-123'
    const userId: UserId = brand<'UserId'>()(raw)
    expect(userId as unknown as string).toBe(raw)
    expect(typeof userId).toBe('string')
  })
})

describe('Brand: type isolation (compile-time)', () => {
  test('nominal typing survives at runtime as identity', () => {
    const u: UserId = brand<'UserId'>()('x')
    const o: OrderId = brand<'OrderId'>()('x')
    expect(u as unknown as string).toBe(o as unknown as string)
  })
})
