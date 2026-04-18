// @ts-nocheck
// Intentional violation: application layer must not import drizzle-orm.
// Expected: biome check returns non-zero with message containing "Repository port".
import { drizzle } from 'drizzle-orm'

export const x = drizzle
