#!/usr/bin/env bash
#
# verify-friction-tally.sh — Phase 4 ADR 0018 trigger enforcer (D-16).
#
# Reads .planning/phases/04-demo-domain/04-HARNESS-FRICTION.md and checks:
#   - Total friction events = number of lines matching `^- \[[0-9]` in the Events section
#   - Structural events = number of lines containing `structural: yes`
#
# Trigger rule (D-16): > 3 total events OR any structural=yes → ADR 0018 must exist.
#
# Exit codes:
#   0 — No trigger, OR trigger hit AND ADR 0018 present (phase exit allowed)
#   1 — Trigger hit AND ADR 0018 missing (phase exit BLOCKED, must ship ADR)
#   2 — Input file(s) missing (script misuse)
#
# Usage:
#   bash .planning/phases/04-demo-domain/verify-friction-tally.sh
#
# From repo root.

set -euo pipefail

FRICTION_LOG=".planning/phases/04-demo-domain/04-HARNESS-FRICTION.md"
ADR_0018="docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md"

if [[ ! -f "$FRICTION_LOG" ]]; then
  echo "ERROR: $FRICTION_LOG not found (Plan 04-01 Task 4 should have shipped the template)" >&2
  exit 2
fi

# Restrict to ## Events … ## Tally so documentation lines cannot false-trigger.
EVENTS_BLOCK=$(awk '/^## Events$/,/^## Tally$/ { if (/^## Events$/ || /^## Tally$/) next; print }' "$FRICTION_LOG")

# Event bullets: real entries start with "- [YYYY" where YYYY is digits (timestamp), not template placeholders.
total=$(printf '%s\n' "$EVENTS_BLOCK" | grep -cE '^- \[[0-9]{4}-' || true)
# Structural: only count lines that look like completed event bullets ending in structural: yes (not yes/no docs)
structural=$(printf '%s\n' "$EVENTS_BLOCK" | grep -E '^- \[[0-9]{4}-' | grep -cE 'structural:[[:space:]]*yes[[:space:]]*$' || true)

echo "Friction tally from $FRICTION_LOG:"
echo "  Total events:      $total"
echo "  Structural events: $structural"

# Trigger check
triggered=0
if [[ $total -gt 3 ]]; then
  echo "  TRIGGER: total events ($total) > 3"
  triggered=1
fi
if [[ $structural -gt 0 ]]; then
  echo "  TRIGGER: structural events present ($structural)"
  triggered=1
fi

if [[ $triggered -eq 0 ]]; then
  echo "No ADR 0018 trigger — phase exit allowed."
  exit 0
fi

# Trigger hit — ADR 0018 MUST exist
if [[ ! -f "$ADR_0018" ]]; then
  echo "FAIL: ADR 0018 trigger reached but $ADR_0018 is missing." >&2
  echo "Action: ship docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md and update docs/decisions/README.md index." >&2
  exit 1
fi

# ADR exists — verify it's non-trivial
if [[ $(wc -c < "$ADR_0018") -lt 500 ]]; then
  echo "FAIL: $ADR_0018 exists but is suspiciously short (<500 bytes). Write the actual ADR content." >&2
  exit 1
fi

echo "OK: ADR 0018 trigger hit AND $ADR_0018 is present (>=500 bytes). Phase exit allowed."
exit 0
