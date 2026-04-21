import { type Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import { Elysia } from 'elysia'

/**
 * tracingPlugin — Global HTTP tracing plugin (PROD-03, D-03).
 *
 * Records one OTel span per HTTP request with:
 *   - http.request.method   (ATTR_HTTP_REQUEST_METHOD)
 *   - http.route            (ATTR_HTTP_ROUTE — parametrized template, e.g. /api/agents/:id)
 *   - http.response.status_code (ATTR_HTTP_RESPONSE_STATUS_CODE)
 *   - http.request.duration (latency in ms)
 *
 * IMPORTANT: onError must end the span independently — onAfterHandle does NOT execute
 * when onError fires (Elysia lifecycle guarantee).
 *
 * WHY onBeforeHandle (not onRequest): context.route is only available from onBeforeHandle
 * onwards — PreContext (onRequest) does not have the `route` property.
 */
export function tracingPlugin() {
  const tracer = trace.getTracer('rigging/http')

  return new Elysia({ name: 'rigging/tracing' })
    .derive({ as: 'global' }, () => {
      const spanHolder = { current: null as Span | null }
      const startedAt = { current: 0 }
      return { _span: spanHolder, _spanStart: startedAt }
    })
    .onBeforeHandle({ as: 'global' }, (ctx) => {
      if (!ctx._span || !ctx._spanStart) return
      const span = tracer.startSpan(`${ctx.request.method} ${ctx.route}`, {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: ctx.request.method,
          [ATTR_HTTP_ROUTE]: ctx.route,
        },
      })
      ctx._span.current = span
      ctx._spanStart.current = performance.now()
    })
    .onAfterHandle({ as: 'global' }, (ctx) => {
      if (!ctx._span || !ctx._spanStart) return
      const span = ctx._span.current
      if (!span) return
      const status =
        typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
      const durationMs = Math.round(performance.now() - ctx._spanStart.current)
      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
      span.setAttribute('http.request.duration', durationMs)
      if (status >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR })
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      span.end()
    })
    .onError({ as: 'global' }, (ctx) => {
      if (!ctx._span || !ctx._spanStart) return
      const span = ctx._span.current
      if (!span) return
      const status =
        typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 500)
      const durationMs = Math.round(performance.now() - ctx._spanStart.current)
      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
      span.setAttribute('http.request.duration', durationMs)
      span.setStatus({ code: SpanStatusCode.ERROR, message: ctx.error?.toString() })
      span.end()
    })
}
