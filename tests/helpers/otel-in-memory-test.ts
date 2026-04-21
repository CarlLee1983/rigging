import { resourceFromAttributes } from '@opentelemetry/resources'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

/**
 * Single process-wide OTel test setup so multiple test files sharing `bun test` do not
 * overwrite each other's global TracerProvider / InMemorySpanExporter.
 */
export const otelTestExporter = new InMemorySpanExporter()

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'rigging-test' }),
  spanProcessors: [new SimpleSpanProcessor(otelTestExporter)],
})

let registered = false

export function ensureOtelTestTracerProviderRegistered(): void {
  if (!registered) {
    provider.register()
    registered = true
  }
}
