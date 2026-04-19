#!/usr/bin/env bun
/**
 * Ensures Phase 4 demo tables exist. drizzle-kit migrate can record 0002 while the SQL
 * was never applied (e.g. interrupted run). Integration tests require `agent` + children.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const url =
  process.env.DATABASE_URL ?? 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging'

const sql = postgres(url)
try {
  const rows = await sql`
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent'
    LIMIT 1
  `
  if (rows.length > 0) {
    process.exit(0)
  }
  const path = resolve(import.meta.dir, '../drizzle/0002_demo_domain.sql')
  const body = readFileSync(path, 'utf8')
  const stmts = body.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
  for (const stmt of stmts) {
    await sql.unsafe(stmt)
  }
  console.error('[ensure-agent-schema] Applied drizzle/0002_demo_domain.sql (agent tables were missing).')
} finally {
  await sql.end()
}
