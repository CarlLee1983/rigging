import type { AuthInstance } from '../../infrastructure/better-auth/auth-instance'

export class RequestPasswordResetUseCase {
  constructor(private readonly auth: AuthInstance) {}

  async execute(input: { email: string; redirectTo?: string }): Promise<void> {
    await this.auth.api.requestPasswordReset({
      body: {
        email: input.email,
        redirectTo: input.redirectTo,
      },
    })
  }
}
