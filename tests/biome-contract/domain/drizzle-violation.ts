// @ts-nocheck
// @ts-nocheck
// Intentional violation: domain layer must not import drizzle-orm.
// Expected: biome check returns non-zero with message containing "Move Drizzle usage to".
import { drizzle } from 'drizzle-orm'

export const x = drizzle
