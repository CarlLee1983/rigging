import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { SpanStatusCode } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import { Elysia } from 'elysia'
import { tracingPlugin } from '../../../../src/shared/presentation/plugins/tracing.plugin'
import {
  ensureOtelTestTracerProviderRegistered,
  otelTestExporter,
} from '../../../helpers/otel-in-memory-test'

beforeAll(() => {
  ensureOtelTestTracerProviderRegistered()
})

afterEach(() => {
  otelTestExporter.reset()
})

describe('tracingPlugin', () => {
  test('GET /ping produces span with http.route and status 200', async () => {
    const app = new Elysia().use(tracingPlugin()).get('/ping', () => ({ pong: true }))

    await app.handle(new Request('http://localhost/ping'))

    const spans = otelTestExporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0]?.attributes[ATTR_HTTP_ROUTE]).toBe('/ping')
    expect(spans[0]?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(200)
    expect(spans[0]?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('GET')
    expect(spans[0]?.status.code).toBe(SpanStatusCode.OK)
  })

  test('parametrized route template is used (not actual URL)', async () => {
    const app = new Elysia()
      .use(tracingPlugin())
      .get('/items/:id', ({ params }) => ({ id: params.id }))

    await app.handle(new Request('http://localhost/items/42'))

    const spans = otelTestExporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0]?.attributes[ATTR_HTTP_ROUTE]).toBe('/items/:id')
    expect(spans[0]?.attributes[ATTR_HTTP_ROUTE]).not.toBe('/items/42')
  })

  test('route that throws error produces span with ERROR status', async () => {
    const app = new Elysia().use(tracingPlugin()).get('/fail', () => {
      throw new Error('intentional failure')
    })

    await app.handle(new Request('http://localhost/fail'))

    const spans = otelTestExporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR)
  })
})
