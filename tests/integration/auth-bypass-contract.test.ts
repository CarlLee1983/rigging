import { expect, test } from 'bun:test'

/**
 * [AUX-06, Phase 3] app without auth plugin returns 401 on protected routes.
 *
 * P1 ships this stub so the test ID is claimed;
 * Phase 3 (Auth Foundation) will replace `test.skip` with `test` and implement:
 *   1. Bootstrap app WITHOUT .use(authContextPlugin)
 *   2. Call every protected route (those declaring { requireAuth: true })
 *   3. Expect all to return 401 (not 500, not stale data)
 *
 * Reference: AGENTS.md Rigidity Map Tier 1 rule 1; docs/decisions/0006-authcontext-boundary.md;
 * docs/decisions/0007-runtime-guards-via-di.md.
 * Pitfall cross-reference: .planning/research/PITFALLS.md #3 (AuthContext bypass).
 */
test.skip('[AUX-06, Phase 3] app without auth plugin returns 401 on protected routes', () => {
  expect(true).toBe(true)
})
