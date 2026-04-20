---
phase: 08
slug: adr-process-self-check
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-20
---

# Phase 08 — Validation Strategy

> Per-phase validation for **process / documentation / GitHub Actions** evidence. Primary signals are **check run URLs** and **SUMMARY.md** tables; local lint is secondary.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GitHub Actions (`adr-check` workflow) + optional local `bun` script for ADR front matter |
| **Config files** | `.github/workflows/adr-check.yml`, `docs/decisions/*.md`, `docs/decisions/README.md` |
| **Quick local check** | Spot-read 3+ README rows vs file front matter |
| **CI signal** | `gh run list --workflow=adr-check.yml` / PR Checks tab URL |
| **Estimated CI latency** | &lt; 2 minutes |

---

## Sampling Rate

- After **08-01** merge: confirm `adr-check` on a harmless PR still green (optional smoke).
- After **08-02** sacrificial push: **one** failed `adr-check` run with URL recorded — sufficient for ADR-06(a).

---

## Per-Requirement Verification Map

| Requirement | Success criteria (from ROADMAP) | Verification signal | Signal source |
|---------------|------------------------------|----------------------|---------------|
| **ADR-06 (a)** | Malformed ADR PR → `adr-check` fails | `adr-check` job `FAILURE` on sacrificial PR | GitHub check run URL in `08-02-SUMMARY.md` |
| **ADR-06 (b)** | ADR 0000..0018 `status` consistent | Audit table / grep | `08-01-SUMMARY.md` + fixed files |
| **ADR-06 (b)** | README index matches files (≥3 spot checks) | Manual or scripted diff | `08-01-SUMMARY.md` lists rows verified |
| **ADR-06 (c)** | New ADR 0019+ or explicit “no new ADR” | ADR file exists OR milestone note | `08-01-SUMMARY.md` decision section |

---

## Wave 0 Requirements

- [ ] `adr-check` validates MADR minimums when ADR checkbox set (Plan 08-01)
- [ ] Sacrificial PR branch created from post-08-01 `main` (Plan 08-02)

---

## Manual-Only Verifications

| Behavior | Why manual |
|----------|------------|
| GitHub PR close / merge state | UI / `gh pr view` |
| Check run URL capture | Copy from Actions UI |
