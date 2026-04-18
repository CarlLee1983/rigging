# Phase 1 Plan 02 Summary

## Delivered

- `src/shared/kernel/result.ts` — `Result<T, E>` ADT with `ok` / `err` factories + `isOk` / `isErr` / `map` / `mapErr` / `andThen` / `match`. Self-implemented, zero-dep (no `neverthrow` import).
- `src/shared/kernel/brand.ts` — `Brand<T, K>` phantom property type + `brand<K>()` cast helper. Compile-time only, runtime zero-cost (the `__brand` symbol is `declare const`, never emitted).
- `src/shared/kernel/id.ts` — `UUID<K>` alias + `newUUID<K>()` which wraps `crypto.randomUUID()` and brands the v4 UUID.
- `src/shared/kernel/errors.ts` — `DomainError` abstract base (`code: string`, `httpStatus: number`, optional `cause`) with 5 concrete subclasses: `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409).
- `src/shared/kernel/index.ts` — barrel re-export of all four primitives.
- Unit tests in `tests/unit/shared/kernel/`: `result.test.ts`, `brand.test.ts`, `id.test.ts`, `errors.test.ts`.
- Contract test `tests/contract/kernel-framework-free.test.ts` scanning every `src/shared/kernel/*.ts` file for forbidden imports (`elysia`, `drizzle-orm`, `better-auth`, `postgres`, `pino`, `@bogeychan/elysia-logger`).

## Notes

- Kernel 無任何 framework / runtime 依賴；只使用 `Error` 與 `crypto.randomUUID`（Web Platform API，Bun runtime 內建）。
- `Brand<T, K>` 的 phantom property 採 `declare const __brand: unique symbol` + `& { readonly [__brand]: K }`，TypeScript 型別層隔離 `UserId` ≠ `OrderId`，runtime 完全 zero-cost。
- `DomainError.constructor.name` 於子類實例上自動設定為子類別名（`ValidationError`、`UnauthorizedError`…），便於 logging / assertion。
- Phase 2 error-handler plugin 讀 `err.httpStatus` 直接，不需 mapping table。

## Quality Gates

- `bun run lint` → 0 findings（kernel 檔通過 Biome base rules）。
- `bun run typecheck` → exit 0（strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess 全滿足）。
- `bun test tests/unit/shared/kernel tests/contract/kernel-framework-free.test.ts` → all green；covers Result behaviour、Brand type isolation、UUID v4 格式、DomainError httpStatus 對應、kernel framework-free。

## Handoffs

- **Plan 03** — Biome override 會加 rule 封鎖 `src/**/domain/**` import `src/shared/kernel/` 以外的 runtime 套件；kernel barrel (`src/shared/kernel/index.ts`) 為 domain 層唯一可 import 的 shared utility。
- **Phase 2 error-handler** — 讀 `DomainError.httpStatus` 映射至 Elysia `set.status`；不需自製 mapping table。
- **Phase 3 BetterAuth** — `UnauthorizedError` / `ForbiddenError` 將被 AuthContext resolver 於認證失敗時 throw。
- **Phase 4 Evals** — `newUUID<EvalRunId>()` 作為 typed ID factory 範式。
