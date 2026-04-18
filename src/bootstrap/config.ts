import { FormatRegistry, type Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

FormatRegistry.Set('uri', (value) => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
})

// Bootstrap env validation lives outside the DDD feature slices.
// Startup must fail fast on missing or malformed values.
export const ConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ pattern: '^postgresql://.+' }),
  BETTER_AUTH_SECRET: Type.String({ minLength: 32 }),
  BETTER_AUTH_URL: Type.String({ format: 'uri' }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ]),
  LOG_LEVEL: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
  ]),
})

export type Config = Static<typeof ConfigSchema>

function rawEnv() {
  return {
    ...process.env,
    PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
  }
}

export function loadConfig(): Config {
  const source = rawEnv()
  const errors = [...Value.Errors(ConfigSchema, source)]

  if (errors.length > 0) {
    const summary = errors
      .map((error) => `  - ${error.path}: ${error.message} (got: ${JSON.stringify(error.value)})`)
      .join('\n')

    throw new Error(
      `Invalid environment variables. See .env.example for required fields.\n${summary}`,
    )
  }

  return Value.Decode(ConfigSchema, source)
}
