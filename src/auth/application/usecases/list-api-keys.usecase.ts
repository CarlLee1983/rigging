import type { AuthContext } from '../../domain'
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
    return this.identity.listApiKeysByUser(ctx.userId)
  }
}
