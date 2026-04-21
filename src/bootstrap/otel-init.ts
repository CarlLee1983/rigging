import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

/**
 * initTracing — bootstrap-time TracerProvider factory.
 *
 * Called from main.ts AFTER loadConfig() but BEFORE createApp().
 * When endpoint is provided: attaches OTLPTraceExporter (HTTP/JSON to /v1/traces).
 * When endpoint is undefined: provider still registers as global provider, but no exporter
 * is attached — spans are silently dropped (no-op behavior, PROD-03 success criterion #5).
 *
 * OTel SDK 2.x API notes:
 *   - resourceFromAttributes() replaces new Resource() (removed in 2.x)
 *   - spanProcessors constructor option replaces addSpanProcessor() (removed in 2.x)
 *   - SimpleSpanProcessor instead of BatchSpanProcessor (Bun timeout issue #5260)
 *   - exactOptionalPropertyTypes: two conditional branches, never pass undefined
 */
export function initTracing(endpoint?: string): NodeTracerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'rigging',
  })

  const provider = endpoint
    ? new NodeTracerProvider({
        resource,
        spanProcessors: [
          new SimpleSpanProcessor(
            new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
          ),
        ],
      })
    : new NodeTracerProvider({ resource })

  provider.register()
  return provider
}
