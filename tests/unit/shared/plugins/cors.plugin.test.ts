import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { corsPlugin } from '../../../../src/shared/presentation/plugins/cors.plugin'

describe('corsPlugin', () => {
  test('preflight echoes origin, sets credentials:true, and allows x-api-key / x-request-id / content-type / authorization', async () => {
    const app = new Elysia().use(corsPlugin())
    const res = await app.handle(
      new Request('http://localhost/anything', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'x-api-key',
        },
      }),
    )

    // Origin echoed (NOT '*') — required when credentials: true
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')

    const allowedHeaders = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase()
    expect(allowedHeaders).toContain('x-api-key')
    expect(allowedHeaders).toContain('x-request-id')
    expect(allowedHeaders).toContain('content-type')
    expect(allowedHeaders).toContain('authorization')
  })
})
