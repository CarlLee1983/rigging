// @ts-nocheck
// Intentional violation: application layer must not import from domain/internal.
// Expected: biome check returns non-zero with message containing "getXxxService(ctx) factory".
import { UserServiceImpl } from '../../../src/_template/domain/internal/user-service'

export const x = UserServiceImpl
