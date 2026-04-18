// @ts-nocheck
// Intentional violation: domain layer must not import better-auth.
// Expected: biome check returns non-zero with message containing "IIdentityService port".
import { betterAuth } from 'better-auth'

export const x = betterAuth
