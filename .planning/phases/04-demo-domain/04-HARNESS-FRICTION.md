# Phase 4 Harness Friction Log

**Purpose:** Track moments where executor needed to explain harness structure, fight the urge
to write `@ts-ignore`, or detected structural friction in the P1 feature module template.
This log dogfoods Rigidity Map Tier 1/2/3 — if the harness is clean, this log stays short.

**Scope signal (D-15):** Log an event when any of the following happens during Plan 04-02 / 04-03 / 04-04:
- "要解釋給其他開發者 / AI Agent 怎麼擺檔 / 哪層放什麼"
- "想下手寫 @ts-ignore / @ts-expect-error"
- "createXxxModule signature 不夠用 — 要繞著它走"
- "DDD barrel / Biome noRestrictedImports 規則被誤觸要手動繞"
- "測試走橫脖（reach into internal）才能驗"
- "複製貼上 P3 P2 同樣 boilerplate 三次以上"

**ADR Trigger (D-16):** `>3 total events` OR `any single structural: yes` event →
open `docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md` in Plan 04-04.
Tally is verified automatically by `.planning/phases/04-demo-domain/verify-friction-tally.sh` (shipped in Plan 04-04).

**Structural flag (D-15):**
- `structural: yes` — fixing this friction requires changing P1 template / Biome rules / shared kernel. Any single occurrence triggers ADR 0018.
- `structural: no` — local workaround is OK, does not affect framework rigidity.

---

## Events

<!--
Each event is a single bullet, one line, ordered by time. Format:
- [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: <一句話 zh-TW> | workaround: <一句話 zh-TW> | structural: yes/no

Example:
- [2026-04-19 14:23] [04-02-PLAN] symptom: CreatePromptVersionUseCase 的 retry loop 需要讀 postgres-js PostgresError.code 但 port 層不能 import postgres | workaround: repository 捕獲並轉 null，use case 只看 null/non-null | structural: no
-->

(No events yet)

---

## Tally

- Total events: 0
- Structural events: 0
- ADR threshold reached: NO

<!-- When you append an event, update BOTH the Events list AND the Tally counts in the same commit.
     The verifier script grep-counts `^- \[[0-9]` lines for total and `structural: yes` for structural. -->

---

## References

- CONTEXT.md D-15 / D-16 — friction log & ADR trigger rules
- RESEARCH.md §Pitfall 6 — Tally discipline (avoid mis-count)
- Verifier: `.planning/phases/04-demo-domain/verify-friction-tally.sh` (shipped Plan 04-04)
- Conditional ADR: `docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md`
