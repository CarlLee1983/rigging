# Phase 1 Plan 04 Summary

## Delivered

- Seeded 12 MADR 4.0 full-variant ADRs in `docs/decisions/0000-0011`.
- Added `docs/decisions/README.md` with the 12-row index and the required `Supersedes` column.
- Added `.github/PULL_REQUEST_TEMPLATE.md` with the ADR checkpoint and Rigidity Map tier selection.
- Added `.github/workflows/adr-check.yml` to fail PRs that require an ADR but add no new `docs/decisions/*.md` file.
- Added the Rigging Rigidity Map and anti-features sections to `AGENTS.md` at the requested insertion point.

## Notes

- All ADRs use the same bootstrap date `2026-04-19` and the same front matter shape.
- `0011` remains `accepted` in P1 and documents the P3 spike validation plan.
- `0010` keeps the Bun native SQL revisit condition strict: both `bun#21934` and `bun#22395` must be closed before re-evaluation.

## Verification

- Pending targeted repo checks after file creation.
