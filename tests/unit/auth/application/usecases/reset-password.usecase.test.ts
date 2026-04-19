import { describe, expect, test } from 'bun:test'
import { ResetPasswordUseCase } from '../../../../../src/auth/application/usecases/reset-password.usecase'

function makeAuth() {
  const calls: string[] = []
  return {
    calls,
    api: {
      resetPassword: async () => {
        calls.push('resetPassword')
      },
      revokeSessions: async () => {
        calls.push('revokeSessions')
      },
    },
  } as never
}

describe('ResetPasswordUseCase (W-2 JSON-driven scenario branching)', () => {
  test('resetPassword always runs and does not attempt session revocation inline', async () => {
    const auth = makeAuth()
    const uc = new ResetPasswordUseCase(auth)
    await uc.execute({ token: 'token-1', newPassword: 'NewPass123!' })
    expect((auth as { calls: string[] }).calls).toContain('resetPassword')
    expect((auth as { calls: string[] }).calls).not.toContain('revokeSessions')
  })
})
