import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { SpanStatusCode } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import { createApp } from '../../src/bootstrap/app'
import type { Config } from '../../src/bootstrap/config'
import type { IDbHealthProbe } from '../../src/health/application/ports/db-health-probe.port'
import {
  ensureOtelTestTracerProviderRegistered,
  otelTestExporter,
} from '../helpers/otel-in-memory-test'
import { createFakeAuthInstance } from './auth/_helpers'

const TEST_CONFIG: Config = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: 3000,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
}

const fakeDb = {} as never

function stubProbe(impl: () => Promise<'up' | 'down'>): IDbHealthProbe {
  return { probe: impl }
}

beforeAll(() => {
  ensureOtelTestTracerProviderRegistered()
})

afterEach(() => {
  otelTestExporter.reset()
})

describe('OTel HTTP spans — integration (PROD-03)', () => {
  test('GET /health produces span with correct route, method and status (PROD-03 #1, #2)', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      authInstance: createFakeAuthInstance(),
      probe: stubProbe(() => Promise.resolve('up')),
    })

    await app.handle(new Request('http://localhost/health'))

    const spans = otelTestExporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThanOrEqual(1)
    const healthSpan = spans.find((s) => s.attributes[ATTR_HTTP_ROUTE] === '/health')
    expect(healthSpan).toBeDefined()
    expect(healthSpan?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('GET')
    expect(healthSpan?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(200)
    expect(typeof healthSpan?.attributes['http.request.duration']).toBe('number')
  })

  test('error route produces span with ERROR status (PROD-03 #4)', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      authInstance: createFakeAuthInstance(),
      probe: stubProbe(() => Promise.resolve('up')),
    }).get('/demo-error', () => {
      throw new Error('test error')
    })

    await app.handle(new Request('http://localhost/demo-error'))

    const spans = otelTestExporter.getFinishedSpans()
    const errorSpan = spans.find((s) => s.attributes[ATTR_HTTP_ROUTE] === '/demo-error')
    expect(errorSpan).toBeDefined()
    expect(errorSpan?.status.code).toBe(SpanStatusCode.ERROR)
  })

  test('span name format is "METHOD /route"', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      authInstance: createFakeAuthInstance(),
      probe: stubProbe(() => Promise.resolve('up')),
    })

    await app.handle(new Request('http://localhost/health'))

    const spans = otelTestExporter.getFinishedSpans()
    const healthSpan = spans.find((s) => s.attributes[ATTR_HTTP_ROUTE] === '/health')
    expect(healthSpan?.name).toBe('GET /health')
  })
})
