import { defineConfig } from 'drizzle-kit'

// Per ADR 0010 (docs/decisions/0010-postgres-driver-postgres-js.md):
// - App runtime driver is postgres-js, but this file only configures drizzle-kit.
// - We intentionally omit the driver field here per the plan's Pitfall #4 mitigation.
// - If drizzle-kit 0.31.x rejects this config during migration generation, document the fallback
//   and add the smallest required driver field in a later ADR-backed phase.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/infrastructure/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
})
