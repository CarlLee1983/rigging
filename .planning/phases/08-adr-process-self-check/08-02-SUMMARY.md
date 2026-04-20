# 08-02 SUMMARY — adr-check fail-mode (malformed MADR)

**Plan:** 08-02 (Phase 8 / v1.1 Release Validation)
**Requirements:** ADR-06 (a) — shippable evidence that `adr-check` fails on malformed new ADR when the PR declares one
**Status:** Complete
**Started:** 2026-04-20
**Completed:** 2026-04-20

## Metadata

| Item | Value |
|------|-------|
| `base_sha` (before sacrificial commit) | `4240916bb84dc020e6aea536c40780f569b7dc6e` |
| Sacrificial branch | `phase-8-adr-failmode-demo` (deleted from `origin` after close) |
| Sacrificial commit | `746071f` |
| Malformed ADR path (not on `main`) | `docs/decisions/0099-failmode-malformed-adr-demo.md` — missing `deciders` in front matter |
| **Sacrificial PR** | https://github.com/CarlLee1983/rigging/pull/3 |
| **PR final state** | `CLOSED`, `mergedAt`: `null` (`gh pr view 3 --json state,mergedAt`) |

## Evidence table

| Step | Expected | Check / run URL | Result |
|------|----------|-----------------|--------|
| Local `validate:adr` | exit 1 | `bun run validate:adr docs/decisions/0099-failmode-malformed-adr-demo.md` | red — `::error::... key "deciders"` |
| `adr-check` workflow | `FAILURE` (not `SKIPPED`) | https://github.com/CarlLee1983/rigging/actions/runs/24665463308/job/72121823862 | red (expected) |
| Workflow run (aggregate) | `conclusion: failure` | https://github.com/CarlLee1983/rigging/actions/runs/24665463308 | `gh run view 24665463308 --json conclusion` → `failure` |

## PR body gate

Included exact line (matches `.github/workflows/adr-check.yml` grep):

```text
- [x] This PR introduces a decision that requires a new ADR
```

## Cleanup

- Remote branch `phase-8-adr-failmode-demo` deleted: `git push origin --delete phase-8-adr-failmode-demo`
- Local branch deleted after returning to `main`
- **No** `0099-*` file on `main` — fail-mode file existed only on the closed PR branch

## REQUIREMENTS.md

ADR-06 milestone checkbox update remains a human/PM action unless delegated; this SUMMARY is the execution evidence for ADR-06(a).

## Success criteria (ROADMAP Phase 8 SC#1)

- [x] Malformed ADR + experimental PR → `adr-check` fails with URL above; PR closed without merge.

## Self-Check: PASSED

- `gh pr view 3 --json mergedAt` → `null`
- Failing job URL starts with `https://github.com/`
- Evidence table includes `FAILURE` / red as required
