import type { AuthInstance } from '../../infrastructure/better-auth/auth-instance'

export class VerifyEmailUseCase {
  constructor(private readonly auth: AuthInstance) {}

  async execute(input: { token: string; callbackURL?: string }): Promise<void> {
    await this.auth.api.verifyEmail({
      query: {
        token: input.token,
        callbackURL: input.callbackURL,
      },
    })
  }
}
