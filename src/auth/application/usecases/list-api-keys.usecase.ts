import type { AuthContext } from '../../domain'
import { InsufficientScopeError } from '../../domain'
import type { IIdentityService } from '../ports/identity-service.port'

export interface ApiKeyListItemDto {
  id: string
  label: string
  prefix: string
  scopes: ReadonlyArray<string>
  expiresAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

export class ListApiKeysUseCase {
  constructor(private readonly identity: IIdentityService) {}

  async execute(ctx: AuthContext): Promise<ApiKeyListItemDto[]> {
    const scopes = ctx.scopes as ReadonlyArray<string>
    const canList =
      ctx.scopes.includes('*') || scopes.includes('read:*') || scopes.includes('write:*')
    if (!canList) {
      throw new InsufficientScopeError('This operation requires scope read:* or write:*')
    }
    return this.identity.listApiKeysByUser(ctx.userId)
  }
}
