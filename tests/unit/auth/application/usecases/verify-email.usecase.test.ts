import { describe, expect, test } from 'bun:test'
import { VerifyEmailUseCase } from '../../../../../src/auth/application/usecases/verify-email.usecase'

describe('VerifyEmailUseCase', () => {
  test('calls auth.api.verifyEmail with token', async () => {
    const calls: unknown[] = []
    const auth = {
      api: {
        verifyEmail: async (opts: { query: { token: string; callbackURL?: string } }) => {
          calls.push(opts)
        },
      },
    } as never
    const uc = new VerifyEmailUseCase(auth)
    await uc.execute({ token: 'tok-1' })
    expect(calls).toEqual([{ query: { token: 'tok-1', callbackURL: undefined } }])
  })
})
