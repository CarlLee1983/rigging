import { redisStorage } from '@better-auth/redis-storage'
import { Elysia } from 'elysia'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import type { Config } from '../bootstrap/config'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import { CreateApiKeyUseCase } from './application/usecases/create-api-key.usecase'
import { ListApiKeysUseCase } from './application/usecases/list-api-keys.usecase'
import { RegisterUserUseCase } from './application/usecases/register-user.usecase'
import { RequestPasswordResetUseCase } from './application/usecases/request-password-reset.usecase'
import { ResetPasswordUseCase } from './application/usecases/reset-password.usecase'
import { RevokeApiKeyUseCase } from './application/usecases/revoke-api-key.usecase'
import { VerifyEmailUseCase } from './application/usecases/verify-email.usecase'
import type { AuthInstance } from './infrastructure/better-auth/auth-instance'
import { createAuthInstance } from './infrastructure/better-auth/auth-instance'
import { BetterAuthIdentityService } from './infrastructure/better-auth/identity-service.adapter'
import { ConsoleEmailAdapter } from './infrastructure/email/console-email.adapter'
import { ResendEmailAdapter } from './infrastructure/email/resend-email.adapter'
import { DrizzleApiKeyRepository } from './infrastructure/repositories/drizzle-api-key.repository'
import { apiKeyController } from './presentation/controllers/api-key.controller'
import { authController } from './presentation/controllers/auth.controller'
import { meController } from './presentation/controllers/me.controller'
import { authContextPlugin } from './presentation/plugins/auth-context.plugin'

export interface AuthModuleDeps {
  db: DrizzleDb
  logger: Logger
  config: Pick<
    Config,
    | 'BETTER_AUTH_SECRET'
    | 'BETTER_AUTH_URL'
    | 'RESEND_API_KEY'
    | 'RESEND_FROM_ADDRESS'
    | 'REDIS_URL'
  >
  clock?: { now(): Date }
  redis?: Redis
  authInstance?: AuthInstance
}

export function createAuthModule(deps: AuthModuleDeps) {
  const clock = deps.clock ?? { now: () => new Date() }

  const hasApiKey = Boolean(deps.config.RESEND_API_KEY)
  const hasFromAddress = Boolean(deps.config.RESEND_FROM_ADDRESS)

  if (hasApiKey !== hasFromAddress) {
    const missing = hasApiKey ? 'RESEND_FROM_ADDRESS' : 'RESEND_API_KEY'
    const present = hasApiKey ? 'RESEND_API_KEY' : 'RESEND_FROM_ADDRESS'
    throw new Error(
      `Invalid email configuration: ${present} is set but ${missing} is missing. ` +
        `Either set both RESEND_API_KEY and RESEND_FROM_ADDRESS to enable Resend, ` +
        `or leave both unset to use ConsoleEmailAdapter.`,
    )
  }

  const emailPort =
    deps.config.RESEND_API_KEY && deps.config.RESEND_FROM_ADDRESS
      ? new ResendEmailAdapter(
          deps.config.RESEND_API_KEY,
          deps.config.RESEND_FROM_ADDRESS,
          deps.logger,
        )
      : new ConsoleEmailAdapter(deps.logger)

  const secondaryStorage = deps.redis
    ? redisStorage({ client: deps.redis, keyPrefix: 'better-auth:' })
    : undefined

  const auth =
    deps.authInstance ??
    createAuthInstance(deps.db, {
      secret: deps.config.BETTER_AUTH_SECRET,
      baseURL: deps.config.BETTER_AUTH_URL,
      secondaryStorage,
      sendVerificationEmail: async ({ url, email }) => {
        await emailPort.send({
          to: email,
          subject: 'Verify your email',
          body: url,
        })
      },
      sendResetPassword: async ({ url, email }) => {
        await emailPort.send({
          to: email,
          subject: 'Reset your password',
          body: url,
        })
      },
    })

  const apiKeyRepo = new DrizzleApiKeyRepository(deps.db)
  const identity = new BetterAuthIdentityService(auth, apiKeyRepo)

  const registerUser = new RegisterUserUseCase(auth)
  const verifyEmail = new VerifyEmailUseCase(auth)
  const requestPasswordReset = new RequestPasswordResetUseCase(auth)
  const resetPassword = new ResetPasswordUseCase(auth)
  const createApiKey = new CreateApiKeyUseCase(identity, clock)
  const listApiKeys = new ListApiKeysUseCase(identity)
  const revokeApiKey = new RevokeApiKeyUseCase(identity)

  return new Elysia({ name: 'rigging/auth' })
    .mount('/', auth.handler)
    .use(authContextPlugin({ identity }))
    .use(
      authController({
        registerUser,
        verifyEmail,
        requestPasswordReset,
        resetPassword,
      }),
    )
    .use(
      apiKeyController({
        createApiKey,
        listApiKeys,
        revokeApiKey,
      }),
    )
    .use(meController())
}
