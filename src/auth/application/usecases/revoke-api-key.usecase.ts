import type { AuthContext } from '../../domain'
import { getApiKeyService, InsufficientScopeError } from '../../domain'
import type { IIdentityService } from '../ports/identity-service.port'

export class RevokeApiKeyUseCase {
  constructor(private readonly identity: IIdentityService) {}

  async execute(ctx: AuthContext, id: string): Promise<void> {
    const svc = getApiKeyService(ctx)
    void svc

    const canWrite =
      ctx.scopes.includes('*') || (ctx.scopes as ReadonlyArray<string>).includes('write:*')
    if (!canWrite) {
      throw new InsufficientScopeError('This operation requires scope write:*')
    }

    await this.identity.revokeApiKey(id, ctx.userId)
  }
}
