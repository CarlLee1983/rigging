# Roadmap: Rigging

## Milestones

- ✅ **v1.0 Reference App (MVP)** — Phases 1-5 (shipped 2026-04-20) · [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Release Validation** — Phases 6-8 (started 2026-04-20)

## Phases

<details>
<summary>✅ v1.0 Reference App — Phases 1-5 — SHIPPED 2026-04-20</summary>

- [x] Phase 1: Foundation (5/5 plans) — completed 2026-04-19
- [x] Phase 2: App Skeleton (3/3 plans) — completed 2026-04-19
- [x] Phase 3: Auth Foundation (5/5 plans) — completed 2026-04-19
- [x] Phase 4: Demo Domain (4/4 plans) — completed 2026-04-19
- [x] Phase 5: Quality Gate (4/4 plans) — completed 2026-04-20

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 📋 v1.1 Release Validation — Phases 6-8

- [ ] **Phase 6: CI Pipeline Green-Run & Smoke Validation** — push + PR 驗證 3 jobs + drift-check + `/health` smoke 首次全綠，並逐 gate 製造破壞驗證 fail-mode
- [ ] **Phase 7: Phase 04 Security Audit Back-fill** — 執行 `$gsd-secure-phase 04`，產出 `phases/04-demo-domain/SECURITY.md`（threat register + CVE regression + timing-safe + cross-user 404 evidence）
- [ ] **Phase 8: ADR Process Self-Check** — 以 malformed ADR PR 驗證 `adr-check` workflow 擋格式錯誤 + 審計 ADR 0000..0018 status 欄一致 + 視情況補 ADR 0019+

## Phase Details

### Phase 6: CI Pipeline Green-Run & Smoke Validation
**Goal**: 讓 GitHub Actions CI pipeline（3 parallel jobs + migration-drift + createApp/health smoke）在真實 PR 上首次全綠，並逐 gate 製造破壞以證明每個 gate 都能擋 bad PR。
**Depends on**: Nothing (v1.0 CI infrastructure already committed; first real run)
**Requirements**: CI-04, CI-05, OBS-01
**Success Criteria** (what must be TRUE):
  1. 一個非 master 分支的 PR 在 GitHub Actions 上首次 run，lint / typecheck / test+coverage / migration-drift 四個 check items 全綠，PR 頁面可外部驗證
  2. CI pipeline 新增的 smoke step 在該 PR 上真實 boot `createApp(config)` 並對 `/health` 發 HTTP request 取得 200 OK（log 或 job output 可驗）
  3. 刻意製造 biome lint 錯誤的 commit 推上 PR，lint job 變紅並擋住 merge（截圖或 check run URL 可舉證）
  4. 刻意製造 `// @ts-expect-error` 無誤用或改 schema 不補 migration 的 commit 推上 PR，對應 typecheck / test / migration-drift job 變紅（至少 3 類 fail-mode 各驗證一次）
  5. 刻意破壞 config 校驗或 plugin wiring 使 `createApp` 無法啟動，smoke step 變紅並擋住 merge
**Plans**: TBD

### Phase 7: Phase 04 Security Audit Back-fill
**Goal**: 對 v1.0 Phase 04 shipped 的 auth-gated API + API Key hash verify path 做 retroactive threat-mitigation audit，產出 `phases/04-demo-domain/SECURITY.md` 讓 v1.0 從「理論 secure」升級為「文件 self-verified secure」。
**Depends on**: Nothing (Phase 04 code 已 shipped 於 v1.0；這是文件與驗證補票)
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. `phases/04-demo-domain/SECURITY.md` 存在於 repo，外部 reviewer 可直接閱讀
  2. 該文件包含 Phase 04 threat register：每條 threat 對應明確的 mitigation evidence（code path + test 引用）
  3. 該文件記錄 CVE-2025-61928 attack pattern 在 v1.1 head commit 上的 regression 現況（test 名稱 + 通過狀態）
  4. 該文件驗證 API Key hash verify path 為 timing-safe compare（引用現有 1000-iter ratio 0.006 benchmark 或補做一次）
  5. 該文件確認 cross-user 404 matrix 在 Phase 04 代碼 4 個動詞（read/update/delete/list）上皆覆蓋（測試檔 + 行號舉證）
**Plans**: TBD

### Phase 8: ADR Process Self-Check
**Goal**: 驗證 ADR 機制（MADR 4.0 格式 + `adr-check` PR workflow + `docs/decisions/README.md` 索引）在 v1.1 實務上能運作，並整理 ADR 0000..0018 的 status 欄；若 v1.1 過程有新決策，補寫 ADR 0019+。
**Depends on**: Phase 6 (`adr-check` workflow 需在 Phase 6 CI 首跑驗證通過後才驗證得出 gate 行為)
**Requirements**: ADR-06
**Success Criteria** (what must be TRUE):
  1. 以缺 MADR 必要欄位的 malformed ADR 檔案開一個實驗 PR，`adr-check` workflow 判定 fail 並擋下該 PR（check run URL 可舉證）
  2. ADR 0000..0018 status 欄經審計後皆為 `Accepted` / `Superseded` / `Deprecated` 之一，無缺漏無錯字
  3. `docs/decisions/README.md` 索引表每條 ADR 的 status 與實際檔案內容一致（抽查 3 條以上無落差）
  4. 若 v1.1 milestone 過程產生新決策（e.g. CI pipeline 改動、smoke step 加入），新 ADR 0019+ 以 MADR 4.0 格式寫入 `docs/decisions/` 並加入索引；若無新決策則在 milestone close summary 明示「v1.1 無新 ADR」
**Plans**: TBD

## Progress

| Phase                                      | Milestone | Plans | Status      | Completed  |
| ------------------------------------------ | --------- | ----- | ----------- | ---------- |
| 1. Foundation                              | v1.0      | 5/5   | Complete    | 2026-04-19 |
| 2. App Skeleton                            | v1.0      | 3/3   | Complete    | 2026-04-19 |
| 3. Auth Foundation                         | v1.0      | 5/5   | Complete    | 2026-04-19 |
| 4. Demo Domain                             | v1.0      | 4/4   | Complete    | 2026-04-19 |
| 5. Quality Gate                            | v1.0      | 4/4   | Complete    | 2026-04-20 |
| 6. CI Pipeline Green-Run & Smoke Validation| v1.1      | 0/0   | Not started | —          |
| 7. Phase 04 Security Audit Back-fill       | v1.1      | 0/0   | Not started | —          |
| 8. ADR Process Self-Check                  | v1.1      | 0/0   | Not started | —          |

---

_Roadmap created: 2026-04-19_
_v1.0 milestone closed: 2026-04-20 — see `milestones/v1.0-ROADMAP.md`_
_v1.1 Release Validation roadmap appended: 2026-04-20 — Phases 6-8_
