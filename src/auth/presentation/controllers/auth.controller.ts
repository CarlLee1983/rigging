import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { RegisterUserUseCase } from '../../application/usecases/register-user.usecase'
import type { RequestPasswordResetUseCase } from '../../application/usecases/request-password-reset.usecase'
import type { ResetPasswordUseCase } from '../../application/usecases/reset-password.usecase'
import type { VerifyEmailUseCase } from '../../application/usecases/verify-email.usecase'

export interface AuthControllerDeps {
  registerUser: RegisterUserUseCase
  verifyEmail: VerifyEmailUseCase
  requestPasswordReset: RequestPasswordResetUseCase
  resetPassword: ResetPasswordUseCase
}

const RegisterUserBodySchema = Type.Object({
  email: Type.String({ minLength: 1 }),
  password: Type.String({ minLength: 1 }),
  name: Type.Optional(Type.String({ minLength: 1 })),
})

const RegisterUserResponseSchema = Type.Object({
  userId: Type.String(),
})

const VerifyEmailQuerySchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  callbackURL: Type.Optional(Type.String({ minLength: 1 })),
})

const RequestPasswordResetBodySchema = Type.Object({
  email: Type.String({ minLength: 1 }),
  redirectTo: Type.Optional(Type.String({ minLength: 1 })),
})

const ResetPasswordBodySchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 1 }),
})

export function authController(deps: AuthControllerDeps) {
  return new Elysia({ name: 'rigging/auth-controller' })
    .post(
      '/register',
      async ({ body, set }) => {
        const input = {
          email: body.email,
          password: body.password,
          ...(body.name !== undefined ? { name: body.name } : {}),
        }
        const result = await deps.registerUser.execute(input)
        set.status = 201
        return result
      },
      {
        body: RegisterUserBodySchema,
        response: RegisterUserResponseSchema,
        detail: {
          summary: 'Register a new user',
          tags: ['auth'],
        },
      },
    )
    .get(
      '/verify-email',
      async ({ query, set }) => {
        const input = {
          token: query.token,
          ...(query.callbackURL !== undefined ? { callbackURL: query.callbackURL } : {}),
        }
        await deps.verifyEmail.execute(input)
        set.status = 204
      },
      {
        query: VerifyEmailQuerySchema,
        detail: {
          summary: 'Verify a user email address',
          tags: ['auth'],
        },
      },
    )
    .post(
      '/request-password-reset',
      async ({ body, set }) => {
        const input = {
          email: body.email,
          ...(body.redirectTo !== undefined ? { redirectTo: body.redirectTo } : {}),
        }
        await deps.requestPasswordReset.execute(input)
        set.status = 204
      },
      {
        body: RequestPasswordResetBodySchema,
        detail: {
          summary: 'Request a password reset link',
          tags: ['auth'],
        },
      },
    )
    .post(
      '/reset-password',
      async ({ body, set }) => {
        const input = {
          token: body.token,
          newPassword: body.newPassword,
        }
        await deps.resetPassword.execute(input)
        set.status = 204
      },
      {
        body: ResetPasswordBodySchema,
        detail: {
          summary: 'Reset a password using a token',
          tags: ['auth'],
        },
      },
    )
}
