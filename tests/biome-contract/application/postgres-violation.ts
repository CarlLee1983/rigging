// @ts-nocheck
// Intentional violation: application layer must not import postgres.
// Expected: biome check returns non-zero with message containing "Inject the port".
import postgres from 'postgres'

export const x = postgres
