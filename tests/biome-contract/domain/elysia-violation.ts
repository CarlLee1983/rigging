// @ts-nocheck
// Intentional violation: domain layer must not import elysia.
// Expected: biome check returns non-zero with message containing "HTTP concerns belong in".
import { Elysia } from 'elysia'

export const x = Elysia
