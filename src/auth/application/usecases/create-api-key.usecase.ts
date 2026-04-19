import type { IClock } from '../../../shared/application/ports/clock.port'
import type { AuthContext, Scope, UserId } from '../../domain'
import { ScopeNotSubsetError, UserIdMismatchError } from '../../domain'
import type { IIdentityService } from '../ports/identity-service.port'

export interface CreateApiKeyInput {
  userId?: string
  label: string
  scopes: ReadonlyArray<string>
  expiresAt?: Date
}

export interface CreatedApiKeyDto {
  id: string
  key: string
  prefix: string
  label: string
  scopes: ReadonlyArray<string>
  expiresAt: Date
  createdAt: Date
}

export class CreateApiKeyUseCase {
  constructor(
    private readonly identity: IIdentityService,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreateApiKeyInput): Promise<CreatedApiKeyDto> {
    if (input.userId && input.userId !== ctx.userId) {
      throw new UserIdMismatchError('Cannot create API Key for another user')
    }

    if (
      !input.scopes.every(
        (scope) => ctx.scopes.includes('*') || ctx.scopes.includes(scope as Scope),
      )
    ) {
      throw new ScopeNotSubsetError('Requested key scopes must be subset of your session scopes')
    }

    const now = this.clock.now()
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const label = input.label.trim()

    const created = await this.identity.createApiKey({
      userId: ctx.userId as UserId,
      label,
      scopes: input.scopes as ReadonlyArray<Scope>,
      expiresAt,
    })

    return {
      id: created.id,
      key: created.rawKey,
      prefix: created.prefix,
      label,
      scopes: input.scopes,
      expiresAt,
      createdAt: created.createdAt,
    }
  }
}
