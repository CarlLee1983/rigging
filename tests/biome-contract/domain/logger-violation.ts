// @ts-nocheck
// Intentional violation: domain layer must not import logger adapters.
// Expected: biome check returns non-zero with message containing "ILogger from src/shared/application/ports".
import { logger } from '@bogeychan/elysia-logger'

export const x = logger
