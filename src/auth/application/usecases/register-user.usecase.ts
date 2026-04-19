import type { AuthInstance } from '../../infrastructure/better-auth/auth-instance'

export interface RegisterUserInput {
  email: string
  password: string
  name?: string
}

export class RegisterUserUseCase {
  constructor(private readonly auth: AuthInstance) {}

  async execute(input: RegisterUserInput): Promise<{ userId: string }> {
    const result = await this.auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.name ?? input.email,
      },
    })

    return { userId: result.user.id }
  }
}
