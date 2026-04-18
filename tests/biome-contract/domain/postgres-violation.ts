// @ts-nocheck
// Intentional violation: domain layer must not import postgres.
// Expected: biome check returns non-zero with message containing "src/shared/infrastructure/db/client.ts".
import postgres from 'postgres'

export const x = postgres
