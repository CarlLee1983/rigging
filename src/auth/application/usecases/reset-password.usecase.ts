import type { AuthInstance } from '../../infrastructure/better-auth/auth-instance'

export interface ResetPasswordInput {
  token: string
  newPassword: string
}

export class ResetPasswordUseCase {
  constructor(private readonly auth: AuthInstance) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    await this.auth.api.resetPassword({
      body: {
        token: input.token,
        newPassword: input.newPassword,
      },
    })
  }
}
