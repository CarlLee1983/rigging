// @ts-nocheck
// Intentional violation: presentation layer must not import from domain/internal.
// Expected: biome check returns non-zero with message containing "Only the domain/index.ts barrel".
import { UserServiceImpl } from '../../../src/_template/domain/internal/user-service'

export const x = UserServiceImpl
