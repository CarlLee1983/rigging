import { describe, expect, test } from 'bun:test'
import { RegisterUserUseCase } from '../../../../../src/auth/application/usecases/register-user.usecase'

function makeAuth() {
  const calls: Array<unknown> = []
  return {
    calls,
    api: {
      signUpEmail: async (arg: unknown) => {
        calls.push(arg)
        return {
          user: { id: 'u-1' },
          token: 'token-1',
        }
      },
    },
  } as never
}

describe('RegisterUserUseCase', () => {
  test('wraps BetterAuth signUpEmail and returns the user id', async () => {
    const auth = makeAuth()
    const uc = new RegisterUserUseCase(auth)
    const result = await uc.execute({
      email: 'alice@example.com',
      password: 'secret123',
      name: 'Alice',
    })
    expect(result).toEqual({ userId: 'u-1' })
    expect((auth as { calls: unknown[] }).calls).toHaveLength(1)
  })
})
