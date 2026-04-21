---
status: testing
phase: 10-publish-docs
source:
  - 10-01-SUMMARY.md
  - 10-02-SUMMARY.md
  - 10-03-SUMMARY.md
started: "2026-04-20T12:00:00Z"
updated: "2026-04-20T12:00:00Z"
---

## Current Test

number: 1
name: README Getting Started landing
expected: |
  After the title and one-line intro, the first ## section is Getting Started (before Why Rigging).
  Getting Started shows npx create-rigging <project-name>, then bullets with cd → bun install → cp .env.example .env → docker compose up -d → bun test, a link to docs/quickstart.md, and Prerequisites (Node 18+, Bun 1.3+, Docker).
  What NOT Included does not claim the scaffolding CLI is v2 or similar stale disclaimer.
awaiting: user response

## Tests

### 1. README Getting Started landing
expected: First ## after intro is Getting Started; npx create-rigging; workflow bullets; quickstart link; prerequisites; no stale v2 scaffolding disclaimer in What NOT Included
result: [pending]

### 2. create-rigging package version
expected: packages/create-rigging/package.json has "version": "0.1.0"
result: [pending]

### 3. Quickstart scaffold-first structure
expected: docs/quickstart.md has ## Scaffold (fastest path) before ## Dev server; scaffold uses docker compose up -d (no hyphen); ## Developing Rigging Itself at bottom with git clone path using docker-compose (hyphen) for Postgres
result: [pending]

### 4. Published CLI on npm
expected: npm show create-rigging reports version 0.1.0 (public), and npx create-rigging <project-name> successfully scaffolds a new project on a machine with Node 18+
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]
