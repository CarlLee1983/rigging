#!/usr/bin/env bun
/**
 * smoke-health.ts — Phase 6 CI smoke gate (OBS-01 / CI-04)
 *
 * 驗證 createApp(loadConfig()) 能完整 boot 並對 /health 回 200。
 * Walks 全 ADR 0012 plugin chain（requestLogger → cors → errorHandler → swagger → auth → agents → health）。
 * Exit 0 → green；Exit 非零 → red。CI 會把 stderr/stdout 貼進 Actions run log。
 *
 * Landmine note (RESEARCH R1 + R10): test job env 必須含 PORT=3000 且 DATABASE_URL 使用
 * `postgresql://` scheme（非 `postgres://`），否則 loadConfig() 會在 entry 就 throw，
 * smoke 紅燈語意會變成「env 沒設對」而不是「app 壞掉」。Plan 1 Task 2 已在 ci.yml 修妥。
 */
import { createApp } from '../src/bootstrap/app'
import { loadConfig } from '../src/bootstrap/config'

async function main() {
  const config = loadConfig()
  const app = createApp(config)
  const res = await app.handle(new Request('http://localhost/health'))

  if (res.status !== 200) {
    const body = await res.text()
    console.error(`✗ Smoke failed: /health returned ${res.status}`)
    console.error(`  Body: ${body}`)
    process.exit(1)
  }

  const body = (await res.json()) as { ok: boolean; db: string }
  if (!body.ok || body.db !== 'up') {
    console.error(`✗ Smoke failed: body.ok=${body.ok} body.db=${body.db}`)
    process.exit(1)
  }

  console.log('✓ Smoke OK — createApp boot + /health 200 + db up')
}

main().catch((err) => {
  console.error('✗ Smoke threw:', err)
  process.exit(1)
})
