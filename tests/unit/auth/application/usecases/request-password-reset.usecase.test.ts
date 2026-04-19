import { describe, expect, test } from 'bun:test'
import { RequestPasswordResetUseCase } from '../../../../../src/auth/application/usecases/request-password-reset.usecase'

describe('RequestPasswordResetUseCase', () => {
  test('delegates to auth.api.requestPasswordReset', async () => {
    const calls: unknown[] = []
    const auth = {
      api: {
        requestPasswordReset: async (opts: unknown) => {
          calls.push(opts)
        },
      },
    } as never
    const uc = new RequestPasswordResetUseCase(auth)
    await uc.execute({ email: 'a@b.test', redirectTo: 'http://localhost/' })
    expect(calls.length).toBe(1)
  })
})
