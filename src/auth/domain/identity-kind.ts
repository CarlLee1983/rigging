// Domain type: how the resolver identified the caller.
// 'human' — identified via cookie session (D-03 scopes=['*'])
// 'agent' — identified via x-api-key header (D-11 scopes from apiKey row, no sessionId)
export type IdentityKind = 'human' | 'agent'
