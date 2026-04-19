import { describe, expect, mock, test } from 'bun:test'
import { Elysia } from 'elysia'
import { NotFoundError, ValidationError } from '../../../../src/shared/kernel/errors'
import { errorHandlerPlugin } from '../../../../src/shared/presentation/plugins/error-handler.plugin'

function fakeLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    trace: mock(() => {}),
    fatal: mock(() => {}),
    child: mock(function (this: unknown) {
      return this
    }),
  }
}

describe('errorHandlerPlugin', () => {
  test('DomainError → mapped httpStatus + uniform error body shape', async () => {
    const log = fakeLogger()
    const app = new Elysia()
      .derive({ as: 'global' }, () => ({ requestId: 'req-abc' }))
      .use(errorHandlerPlugin(log as never))
      .get('/bad', () => {
        throw new ValidationError('bad email')
      })

    const res = await app.handle(new Request('http://localhost/bad'))
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string }
    }
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'bad email', requestId: 'req-abc' },
    })
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.error).toHaveBeenCalledTimes(0)
    // No stack in the warn payload (D-13)
    const warnArgs = (log.warn as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as {
      stack?: unknown
    }
    expect(warnArgs.stack).toBeUndefined()
  })

  test('NotFoundError → 404 + code=NOT_FOUND', async () => {
    const log = fakeLogger()
    const app = new Elysia()
      .derive({ as: 'global' }, () => ({ requestId: 'r' }))
      .use(errorHandlerPlugin(log as never))
      .get('/missing', () => {
        throw new NotFoundError('user not found')
      })

    const res = await app.handle(new Request('http://localhost/missing'))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  test('non-DomainError → 500 INTERNAL_ERROR + generic message (no leak) + log.error with stack', async () => {
    const log = fakeLogger()
    const app = new Elysia()
      .derive({ as: 'global' }, () => ({ requestId: 'r-500' }))
      .use(errorHandlerPlugin(log as never))
      .get('/boom', () => {
        throw new Error('internal detail that must NOT leak')
      })

    const res = await app.handle(new Request('http://localhost/boom'))
    expect(res.status).toBe(500)
    const bodyText = await res.text()
    expect(bodyText).toContain('INTERNAL_ERROR')
    expect(bodyText).toContain('Internal server error')
    expect(bodyText).toContain('r-500')
    expect(bodyText).not.toContain('internal detail that must NOT leak')
    expect(log.error).toHaveBeenCalledTimes(1)
    const errArgs = (log.error as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as { stack?: unknown }
    expect(errArgs.stack).toBeDefined()
  })
})
