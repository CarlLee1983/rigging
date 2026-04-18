---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0001. Runtime: Bun 1.3.12

## Context and Problem Statement

Rigging needs a runtime that keeps the bootstrap small, fast, and Bun-native. The project is a backend harness, so runtime speed, native TypeScript support, test execution, and low-friction hashing matter more than cross-runtime portability.

## Decision Drivers

- Native TypeScript execution without a separate transpiler.
- A built-in test runner that keeps the repo on one toolchain.
- Native password hashing support for secret handling.
- Strong Elysia compatibility.
- Minimal dependency surface for a greenfield harness.

## Considered Options

- Bun
- Node.js with a tsx-style runner
- Deno

## Decision Outcome

Chosen option: Bun `^1.3.12`, because it gives Rigging native TS, `bun:test`, `Bun.password`, and an execution model aligned with Elysia.

### Consequences

- Good: `Bun.password` provides native argon2id support without adding a third-party hashing dependency.
- Good: `bun:test` becomes the default test runner for the repo.
- Good: Bun is aligned with the rest of the locked stack.
- Bad: a small percentage of npm native modules remain incompatible or fragile on Bun.
- Bad: the runtime choice narrows future portability.
- Note: known native-module pitfalls include packages that rely on native bindings such as bcrypt-style or sqlite-style modules.

## Pros and Cons of the Options

### Bun

- Good: native TypeScript, built-in test tooling, and built-in password hashing.
- Good: best fit for an Elysia-first harness.
- Bad: some ecosystem edges still exist around native modules.

### Node.js with a tsx-style runner

- Good: widest ecosystem compatibility.
- Bad: adds an extra runner layer and loses Bun-native primitives.

### Deno

- Good: modern runtime design.
- Bad: less aligned with the stack already locked for Rigging.
