import { createApp } from './bootstrap/app'
import { loadConfig } from './bootstrap/config'
import { initTracing } from './bootstrap/otel-init'

const config = loadConfig()
initTracing(config.OTEL_EXPORTER_OTLP_ENDPOINT)

const app = createApp(config)

app.listen(config.PORT, ({ hostname, port }) => {
  // Startup log uses console.log (pino isn't in scope here; it's bound to the Elysia context).
  // Request logs use pino internally via requestLoggerPlugin.
  console.log(`[rigging] listening on http://${hostname}:${port}`)
  console.log(`[rigging] health:  http://${hostname}:${port}/health`)
  console.log(`[rigging] swagger: http://${hostname}:${port}/swagger`)
})
