import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { serializeSignedCookie } from 'better-call'
import { Elysia } from 'elysia'
import type { IEmailPort } from '../../../src/auth/application/ports/email.port'
import { CreateApiKeyUseCase } from '../../../src/auth/application/usecases/create-api-key.usecase'
import { ListApiKeysUseCase } from '../../../src/auth/application/usecases/list-api-keys.usecase'
import { RegisterUserUseCase } from '../../../src/auth/application/usecases/register-user.usecase'
import { RequestPasswordResetUseCase } from '../../../src/auth/application/usecases/request-password-reset.usecase'
import { ResetPasswordUseCase } from '../../../src/auth/application/usecases/reset-password.usecase'
import { RevokeApiKeyUseCase } from '../../../src/auth/application/usecases/revoke-api-key.usecase'
import { VerifyEmailUseCase } from '../../../src/auth/application/usecases/verify-email.usecase'
import type { AuthContext } from '../../../src/auth/domain'
import { UnauthenticatedError } from '../../../src/auth/domain'
import type { AuthInstance } from '../../../src/auth/infrastructure/better-auth/auth-instance'
import { createAuthInstance } from '../../../src/auth/infrastructure/better-auth/auth-instance'
import { BetterAuthIdentityService } from '../../../src/auth/infrastructure/better-auth/identity-service.adapter'
import { ConsoleEmailAdapter } from '../../../src/auth/infrastructure/email/console-email.adapter'
import { DrizzleApiKeyRepository } from '../../../src/auth/infrastructure/repositories/drizzle-api-key.repository'
import { DrizzleUserRepository } from '../../../src/auth/infrastructure/repositories/drizzle-user.repository'
import { authController } from '../../../src/auth/presentation/controllers/auth.controller'
import { meController } from '../../../src/auth/presentation/controllers/me.controller'
import { authContextPlugin } from '../../../src/auth/presentation/plugins/auth-context.plugin'
import type { Config } from '../../../src/bootstrap/config'
import type { IClock } from '../../../src/shared/application/ports/clock.port'
import {
  createDbClient,
  type DbClient,
  type DrizzleDb,
} from '../../../src/shared/infrastructure/db/client'
import { errorHandlerPlugin } from '../../../src/shared/presentation/plugins/error-handler.plugin'
import {
  createPinoLogger,
  requestLoggerPlugin,
} from '../../../src/shared/presentation/plugins/request-logger.plugin'

export const TEST_CONFIG: Config = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: 3000,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
}

export function createFakeAuthInstance(): AuthInstance {
  return {
    handler: new Elysia({ name: 'smoke-fake-auth' }),
    api: {
      getSession: async () => null,
      verifyApiKey: async () => null,
      createApiKey: async () => ({
        key: 'rig_live_x',
        apiKey: { id: 'k', prefix: 'rig_live_', start: 'rig_live_', createdAt: new Date() },
      }),
      listApiKeysByUser: async () => [],
      revokeApiKey: async () => {},
      signUpEmail: async () => ({
        user: {
          id: 'u',
          email: 'u@example.test',
          emailVerified: false,
          name: 'u',
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 't',
      }),
      signInEmail: async () => ({
        user: {
          id: 'u',
          email: 'u@example.test',
          emailVerified: false,
          name: 'u',
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: 's',
          token: 't',
          userId: 'u',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 't',
      }),
      signOut: async () => ({ status: true }),
      verifyEmail: async () => ({ status: true }),
      requestPasswordReset: async () => ({ status: true, message: 'ok' }),
      resetPassword: async () => ({ status: true }),
      revokeSessions: async () => ({ status: true }),
      deleteApiKey: async () => ({ success: true }),
    },
  } as unknown as AuthInstance
}

export interface TestHarness {
  app: Elysia
  auth: AuthInstance
  db: DrizzleDb
  sql: DbClient['sql']
  emailOutbox: {
    verification: string[]
    reset: string[]
  }
  identity: BetterAuthIdentityService
  apiKeys: DrizzleApiKeyRepository
  users: DrizzleUserRepository
  createApiKey: CreateApiKeyUseCase
  listApiKeys: ListApiKeysUseCase
  revokeApiKey: RevokeApiKeyUseCase
  registerUser: RegisterUserUseCase
  verifyEmail: VerifyEmailUseCase
  requestPasswordReset: RequestPasswordResetUseCase
  resetPassword: ResetPasswordUseCase
  resolveAuthContext: (headers: Headers) => Promise<AuthContext | null>
  requireAuthContext: (headers: Headers) => Promise<AuthContext>
  dispose: () => Promise<void>
}

function makeEmailPort(bucket: string[]): IEmailPort {
  return {
    async send(params) {
      const logger = new ConsoleEmailAdapter({
        info: (_meta: unknown, message: string) => {
          bucket.push(message)
        },
      } as never)
      await logger.send(params)
    },
  }
}

function makeAuth(db: DrizzleDb, emailOutbox: TestHarness['emailOutbox']) {
  return createAuthInstance(db, {
    secret: TEST_CONFIG.BETTER_AUTH_SECRET,
    baseURL: TEST_CONFIG.BETTER_AUTH_URL,
    sendVerificationEmail: async ({ url, email }) => {
      await makeEmailPort(emailOutbox.verification).send({
        to: email,
        subject: 'Verify your email',
        body: url,
      })
    },
    sendResetPassword: async ({ url, email }) => {
      await makeEmailPort(emailOutbox.reset).send({
        to: email,
        subject: 'Reset your password',
        body: url,
      })
    },
  }) as unknown as AuthInstance
}

export async function signUpAndSignIn(
  harness: TestHarness,
  email: string,
  password: string,
): Promise<{ signUp: { user: { id: string } }; headers: Headers; cookie: string; userId: string }> {
  const signUp = await harness.auth.api.signUpEmail({
    body: {
      name: email.split('@')[0] ?? 'Test User',
      email,
      password,
    },
  })
  await followLatestVerificationEmail(harness)
  const { headers, cookie } = await signInAndGetHeaders(harness, email, password)
  return {
    signUp,
    headers,
    cookie,
    userId: signUp.user.id,
  }
}

export async function signInAndGetHeaders(
  harness: TestHarness,
  email: string,
  password: string,
): Promise<{ headers: Headers; cookie: string }> {
  const signIn = await harness.auth.api.signInEmail({
    body: {
      email,
      password,
    },
  })
  const cookie = await serializeSessionCookie(harness, signIn.token)
  return {
    headers: new Headers({ cookie }),
    cookie,
  }
}

export async function serializeSessionCookie(harness: TestHarness, token: string) {
  const ctx = await harness.auth.$context
  const signedCookie = await serializeSignedCookie(
    ctx.authCookies.sessionToken.name,
    token,
    ctx.secret,
    ctx.authCookies.sessionToken.attributes,
  )
  return signedCookie.split(';')[0] ?? ''
}

export async function getLatestSessionToken(
  sql: DbClient['sql'],
  userId: string,
  fallback = '',
): Promise<string> {
  const rows = (await sql`
    SELECT token
    FROM "session"
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ token: string }>
  return rows[0]?.token ?? fallback
}

export async function followLatestVerificationEmail(harness: TestHarness) {
  const url = harness.emailOutbox.verification.at(-1)
  if (!url) throw new Error('missing verification email')
  const token = extractTokenFromUrl(url)
  await harness.verifyEmail.execute({ token })
  return { url, token }
}

export async function followLatestResetEmail(harness: TestHarness, newPassword: string) {
  const url = harness.emailOutbox.reset.at(-1)
  if (!url) throw new Error('missing reset email')
  const token = extractTokenFromUrl(url)
  await harness.resetPassword.execute({ token, newPassword })
  return { url, token }
}

export async function insertTestApiKey(
  sql: DbClient['sql'],
  userId: string,
  opts: { scopes?: string[]; expiresAt?: Date | null } = {},
) {
  const suffix = randomBytes(48).toString('base64url')
  const rawKey = `rig_live_${suffix}`
  const prefix = rawKey.slice(0, 8)
  const hash = Buffer.from(createHash('sha256').update(rawKey).digest()).toString('base64url')
  const id = randomUUID()
  const now = new Date().toISOString()
  const expiresAt = opts.expiresAt ? opts.expiresAt.toISOString() : null

  await sql`
    INSERT INTO "apikey" (
      id,
      config_id,
      name,
      start,
      reference_id,
      prefix,
      key,
      enabled,
      rate_limit_enabled,
      rate_limit_time_window,
      rate_limit_max,
      request_count,
      expires_at,
      created_at,
      updated_at,
      metadata
    )
    VALUES (
      ${id},
      'default',
      'test-key',
      ${prefix},
      ${userId},
      ${prefix},
      ${hash},
      true,
      true,
      86400000,
      10,
      0,
      ${expiresAt},
      ${now},
      ${now},
      ${JSON.stringify({ scopes: opts.scopes ?? ['*'] })}
    )
  `

  return { rawKey, id, prefix, hash }
}

function serializeAuthContext(ctx: AuthContext) {
  return ctx.identityKind === 'agent'
    ? {
        identityKind: ctx.identityKind,
        userId: ctx.userId,
        scopes: ctx.scopes,
        apiKeyId: ctx.apiKeyId,
      }
    : {
        identityKind: ctx.identityKind,
        userId: ctx.userId,
        scopes: ctx.scopes,
        sessionId: ctx.sessionId,
      }
}

function extractTokenFromUrl(url: string): string {
  const normalized = url.includes('CLICK THIS:') ? (url.split('CLICK THIS:').at(-1) ?? url) : url
  const parsed = new URL(normalized.trim())
  const queryToken =
    parsed.searchParams.get('token') ??
    parsed.searchParams.get('verificationToken') ??
    parsed.searchParams.get('resetToken')
  if (queryToken) return queryToken

  const parts = parsed.pathname.split('/').filter(Boolean)
  const maybe = parts.at(-1)
  if (maybe && maybe !== 'verify-email' && maybe !== 'reset-password') {
    return maybe
  }

  throw new Error(`Unable to extract token from ${url}`)
}

export function makeTestApp(): TestHarness {
  const dbClient = createDbClient({ DATABASE_URL: TEST_CONFIG.DATABASE_URL })
  const emailOutbox = { verification: [] as string[], reset: [] as string[] }
  const auth = makeAuth(dbClient.db, emailOutbox)
  const logger = createPinoLogger({
    NODE_ENV: TEST_CONFIG.NODE_ENV,
    LOG_LEVEL: TEST_CONFIG.LOG_LEVEL,
  })
  const apiKeys = new DrizzleApiKeyRepository(dbClient.db)
  const users = new DrizzleUserRepository(dbClient.db)
  const identity = new BetterAuthIdentityService(auth, apiKeys)
  const clock: IClock = { now: () => new Date('2026-04-19T00:00:00.000Z') }
  const createApiKey = new CreateApiKeyUseCase(identity, clock)
  const listApiKeys = new ListApiKeysUseCase(identity)
  const revokeApiKey = new RevokeApiKeyUseCase(identity)
  const registerUser = new RegisterUserUseCase(auth)
  const verifyEmail = new VerifyEmailUseCase(auth)
  const requestPasswordReset = new RequestPasswordResetUseCase(auth)
  const resetPassword = new ResetPasswordUseCase(auth)

  async function resolveAuthContext(headers: Headers) {
    const apiKeyHeader = headers.get('x-api-key')
    if (apiKeyHeader) {
      return identity.verifyApiKey(apiKeyHeader)
    }
    const cookieHeader = headers.get('cookie') ?? ''
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)(?:better-auth\.)?session_token=([^;]+)/)
    const token = tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : null
    if (!token) return null

    const rows = (await dbClient.sql`
      SELECT
        s.id AS "sessionId",
        s.user_id AS "userId",
        s.expires_at AS "expiresAt"
      FROM "session" s
      WHERE s.token = ${token}
      LIMIT 1
    `) as Array<{
      sessionId: string
      userId: string
      expiresAt: Date
    }>
    const row = rows[0]
    if (!row) return null
    if (row.expiresAt.getTime() <= Date.now()) return null

    return {
      userId: row.userId as AuthContext['userId'],
      identityKind: 'human' as const,
      scopes: ['*'] as AuthContext['scopes'],
      sessionId: row.sessionId,
    }
  }

  async function requireAuthContext(headers: Headers) {
    const ctx = await resolveAuthContext(headers)
    if (!ctx) {
      throw new UnauthenticatedError('Authentication required')
    }
    return ctx
  }

  const app = new Elysia({ name: 'rigging/test-auth-app' })
    .use(requestLoggerPlugin(logger))
    .use(errorHandlerPlugin(logger))
    .mount('/api/auth', auth.handler)
    .use(authContextPlugin({ identity }))
    .use(
      authController({
        registerUser,
        verifyEmail,
        requestPasswordReset,
        resetPassword,
      }),
    )
    .use(meController())
    .post(
      '/api-keys',
      async ({ request, authContext, set }) => {
        const body = (await request.json()) as {
          userId?: string
          label: string
          scopes?: string[]
          expiresAt?: string
        }
        const input = {
          label: body.label,
          scopes: body.scopes ?? ['*'],
          ...(body.userId ? { userId: body.userId } : {}),
          ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
        }
        const result = await createApiKey.execute(authContext as AuthContext, input)
        set.status = 201
        return {
          ...result,
          expiresAt: result.expiresAt.toISOString(),
          createdAt: result.createdAt.toISOString(),
          scopes: [...result.scopes],
        }
      },
      { requireAuth: true },
    )
    .get('/api-keys', async ({ authContext }) => listApiKeys.execute(authContext as AuthContext), {
      requireAuth: true,
    })
    .delete(
      '/api-keys/:id',
      async ({ authContext, params }) => {
        const revoked = await apiKeys.markRevoked(params.id, (authContext as AuthContext).userId)
        return { revoked }
      },
      { requireAuth: true },
    )
    .get(
      '/scope-check/protected',
      ({ authContext }) => ({
        authContext: serializeAuthContext(authContext as AuthContext),
      }),
      {
        requireAuth: true,
      },
    )
    .get('/scope-check/public', () => ({ ok: true }))

  return {
    app,
    auth,
    db: dbClient.db,
    sql: dbClient.sql,
    emailOutbox,
    identity,
    apiKeys,
    users,
    createApiKey,
    listApiKeys,
    revokeApiKey,
    registerUser,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    resolveAuthContext,
    requireAuthContext,
    dispose: async () => {
      await dbClient.sql.end({ timeout: 5 })
    },
  } as unknown as TestHarness
}
