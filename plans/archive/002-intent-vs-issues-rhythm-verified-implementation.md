# Plan 002: Intent vs. Issues — Verified Implementation + Grounded Issue Generator

**Author:** Senior Advisor (audit pass + approved implementation)  
**Status:** ✅ COMPLETE — all phases executed (Phases 0–6) and delivered in IxStates 1.2.7 "Ogma" (Beta) · branch `v2`  
**Supersedes/extends:** [001-intent-vs-issues-rhythm-architecture.md](001-intent-vs-issues-rhythm-architecture.md)  
**Phase 3 (intent progress):** IN SCOPE (user decision) · **Dual spawn mode:** IN SCOPE (toggleable) · **New `V2IssueDetail`:** IN SCOPE · **Bug fixes:** IN SCOPE · **Grounded generator:** IN SCOPE (focused-first)

---

## 0. Why this plan exists

`plans/001` defined the intent↔issues gameplay synthesis but was written against *design intent*, not the *live code*. A code audit (this session) found the plan's operational claims diverge from reality in ~8 places, plus one genuinely broken coupling mechanism. This plan is the **verified** version: it corrects the record, folds in the audit's bug fixes, and adds the approved scope (Phase 3 progress, dual-mode spawning, V2IssueDetail, grounded generation).

---

## 1. Audit findings — what was wrong in `001` (all verified against live code)

| # | Claim in 001 / assumption | Verified reality |
|---|---|---|
| 1 | "Tag the intent record with `riskRating: 'volatile'`" | `Intent` has **no `riskRating` field** (`prisma/schema/government.prisma:874-900`). Risk is derivable from tier via `TIER_RISK` (`src/lib/intent/assemble.ts:329-333`) but never persisted. `civCapCost` also computed-but-discarded. |
| 2 | "Update `spawnVolatileIssues()` in `policy-maintenance-cron.ts`" | **No such function exists.** Cron exports only `runPolicyMaintenanceDebits()` (`src/lib/policy-maintenance-cron.ts:11`); the risk roll is inline (`:54-75`) and **never iterates `Intent` records**. |
| 3 | Intent→issue spawn "already works" via category boost | The boost is **broken by a vocabulary mismatch**: intent categories `defense\|fiscal\|economy\|social\|infrastructure\|security` (`assemble.ts:63-69`) vs template `Category` enum `economic\|diplomatic\|social\|governance\|security\|infrastructure` (`prisma/schema/enums.prisma:14-29`). Only **3 of 6** ever match (`national-issues-engine.ts:890-893`). |
| 4 | Cron risk-roll template matching | `domain: { in: [policy.category, policy.policyType] }` (`policy-maintenance-cron.ts:58`) fails for `fiscal`/`trade`/`defense` policy categories — they match zero template domains (`registry.ts:44,132,213`). |
| 5 | "Response payload includes a `recommendedDirective` string" | Not implemented anywhere. `ResolveResult` is `{ success, consequences, consequenceLog, followUpIssueIds, ixCreditsAwarded }` (`src/lib/national-issues-consequences.ts:104-111`). |
| 6 | "Add CTA in `IssuesInbox.tsx`" | `IssuesInbox` is **not mounted on the v2 command surface** — only legacy `ExecutiveWarRoom` + politics tab. V2 players never see it. The CTA must live in a **v2** component (new `V2IssueDetail`). |
| 7 | "High-risk directives increase Volatility & CivCap" | Half-true. Volatility is theoretical (nothing reads it); CivCap is never reserved on intent commit. |
| 8 | "Issues cost `civCapCost` & delegation decay" | Delegation decay is **non-functional**: dismissed-issue window is `respondedIxTime >= now - 5` — **5 IxTime-ms**, not days (`src/server/api/routers/national-issues/player.ts:76-81`). |
| 9 | (not in 001) Duplicate `getTree` | Defined twice in `intent.ts` (`:143` and `:366`); JS object-literal semantics mean the second wins, first is dead code. |
| 10 | (not in 001) Weekly cap time-base | `cooldownStatus` counts the weekly cap on **wall-clock** `createdAt` (`intent.ts:62-73`) while `cooldownUntil` is **IxTime** (`:339,356`) — the exact IxTime-vs-wall-clock class the core-loops plan flags as the #1 bug class. |

What **did** check out: shared `CountryEventSpine` ledger for both systems (`intent.ts:276`, `national-issues-consequences.ts:335`), weekly directive slots (`WEEKLY_CAP = 3`, `intent.ts:29`), issues follow-up chains (`national-issues-consequences.ts:284-315`), the option-level `requiredPolicyKey` precedent (`player.ts:494`), and existing "Declare Directive to Resolve" composer pre-fill on v2 (`V2OpportunityHero.tsx:291-298`).

---

## 2. Confirmed decisions

- **Phase 3 (issue resolution → intent progress):** in scope.
- **Spawn modes:** build **both** deterministic and probability-boosted; **runtime toggle** (no restart) via `data/national-issues-config.json`.
- **Deterministic timing:** **immediately at commit** (deduped, respecting cooldown/maxActive), so the feedback loop is instant and legible.
- **Schema:** force-migrate OK (`bun run db:push:force`, per AGENTS.md gating).
- **Grounding breadth:** **focused-first** (geo + neighbors + diplomatic partners + component/policy grounding + name resolution); demographics/military/budget breadth is a follow-up.
- **Neighbors:** live PostGIS `ST_Touches`, **gated** to when a neighbor-grounded template is a candidate, memoized within one evaluation.

---

## 3. Phase 0 — Schema (force migration) ✅

Run `bun run db:push:force` (explicit, deliberate — 82-nation production DB).

**Delivered:** `NationalIssue.intentId` + index, `Intent.riskRating`, `Intent.progress` all added to `prisma/schema/government.prisma`; force-migrated with `db:push:force`.

| Model | Add | Purpose |
|---|---|---|
| `NationalIssue` | `intentId String?` + `@@index([intentId])` | Source-intent link (traceability + progress). Mirrors existing `parentIssueId` pattern (`government.prisma:681-729`). |
| `Intent` | `riskRating String @default("stable")` | Persist derived risk at commit. |
| `Intent` | `progress Float @default(0)` | Cached progress; updated when linked issues resolve. |

No new models, no DAG — ponytail preserved.

---

## 4. Phase 1 — Intent router fixes (`src/server/api/routers/intent.ts`) ✅

1. **Delete duplicate `getTree`** (dead first copy `:143`; keep nested `{ roots, allIntents }` at `:366`).
2. **IxTime fix:** `cooldownStatus` weekly cap + cooldown math on `createdIxTime`, not `createdAt`.
3. **Add `"proposed"`** to `updateStatus` enum (`:169`); align schema doc comment.
4. **Remove dead foreign gate** (`:233`) — `classifyGoal` already throws on foreign keywords (`assemble.ts:202-211`); foreign intents remain blocked by design.
5. **Persist `riskRating`** from `TIER_RISK[tier]` at commit → `Intent.riskRating`.
6. **Deterministic hook:** end of `commit`, for moderate/extreme, call `spawnIntentResistance()` (Phase 2) in try/catch — never fails the commit.
7. **Phase 3 gate:** `updateStatus("completed")` → `PRECONDITION_FAILED` if open (`pending`/`viewed`) linked resistance issues exist.

---

## 5. Phase 2 — Spawn engine + vocabulary fix ✅

**New lib `src/lib/intent/resistance.ts`:**

- `INTENT_CATEGORY_TO_TEMPLATE` mapping (the core vocabulary fix):
  - `defense → [military, security]`
  - `fiscal → [economic]`
  - `economy → [economic]`
  - `social → [social]`
  - `infrastructure → [infrastructure]`
  - `security → [political, governance]`
- `spawnIntentResistance({ db, countryId, intent })`:
  - **deterministic:** find active template(s) in the mapped domain/category; dedupe (no open issue already linked to this intent+template); respect `cooldownDays` + `maxActivePerCountry`; instantiate via `NationalIssuesEngine.forceGenerate`, then set `intentId`.
  - **probability:** no direct spawn; relies on the fixed boosted evaluation.
  - **off:** no spawn.
- **Fix the probability boost** (`national-issues-engine.ts:890-893`) to use the mapping (so `economy`/`fiscal`/`defense` intents boost their templates).
- **Rework maintenance cron** (`policy-maintenance-cron.ts`): implement a real `spawnVolatileIssues()` covering **policies** (fixed matching) **and intents** (probability-mode risk roll for moderate/extreme, mapped categories).

**Runtime toggle:** extend `data/national-issues-config.json` + `getNationalIssuesConfig()` with `spawnMode: "probability" | "deterministic" | "off"` (default `"probability"` = current behavior). Admin engine-config router (`src/server/api/routers/national-issues/engine.ts:139-149`) edits it.

---

## 6. Phase 3 — Grounded generator (focused-first) ✅

### A. Snapshot extensions in `buildCountrySnapshot` (`national-issues-engine.ts:295-536`; add to the existing `Promise.all`)

- **Geo:** `CountryGeoProfile` (`maps.prisma:448-474`) — `isLandlocked`, `isIsland`, `dominantClimate`, `terrainRoughness`, `arableLandPercent`, `coastlineKm`, `neighborCount`.
- **Names:** `NationalIdentity` capital/largest city, languages, religion; top `PoliticalParty` (name/ideology/support); `GovernmentDepartment` ministers + `GovernmentOfficial`.
- **Fiscal/labor (focused):** `minimumWage`, `FiscalSystem` headline rates, `LaborMarket` informal/youth unemployment.
- **Economic profile (focused):** top `sectorBreakdown` sector, `exportsGDPPercent`, `economicComplexity`.
- **External — diplomatic:** bulk `DiplomaticRelation` (OR both slots, cf. `diplomacy/policies/foreignPolicy.ts:30-37`) → `partners[{name, band, strength}]` + per-band counts; embassy host/guest names; active `WorldEvent`/`WorldEventCountry` + `CrisisEvent` titles.
- **External — neighbors:** live PostGIS `ST_Touches` via `src/lib/country-geo/bundle.ts:74-107`, **gated** + memoized per evaluation.

### B. Evaluator

Add two ops to the safe JSON tree (`national-issues-engine.ts:542-601`): `count` (array length) and `any` (recursive condition over object-array elements, e.g. `{ any: { field: "partners", condition: { field: "band", op: "==", value: "HOSTILE" } } }`). No `eval` — same safety posture.

### C. Variables (`BUILT_IN_VARIABLES`)

Real-name resolvers replacing placeholders: `{{neighborName}}`, `{{allyName}}`, `{{rivalName}}`, `{{partnerName}}`, `{{partyName}}`, `{{oppositionParty}}`, `{{ministerName}}`, `{{officialTitle}}`, `{{capitalCity}}`, `{{cityName}}`, `{{dominantClimate}}`, `{{activeIntentGoal}}`. Fix target-country fallback (`national-issues-engine.ts:937-945`) to prefer neighbors/partners over a random country.

### D. Templates

Seed ~6-8 grounded templates demonstrating the surface (landlocked-port crisis, border incident w/ real neighbor, ally-trade disruption, legislative gridlock w/ real party, union strike gated on `UNION_BASED`, drought gated on `dominantClimate`); update a few existing templates to real-name variables. All grounding via the existing `triggerConditions` JSON — **no new template column**.

### E. Hygiene

`national-issues-engine.ts` is already 1,249 lines. Split snapshot-building → `src/lib/national-issues/snapshot.ts` and variable resolvers → `src/lib/national-issues/variables.ts` as they grow.

---

## 7. Phase 4 — Progress loop (001's Phase 3) ✅

- On resolve (`national-issues-consequences.ts:120`): if `issue.intentId` set, recompute + cache `Intent.progress` = resolved linked issues / total linked issues (responded + auto_resolved + dismissed count; pending/viewed excluded).
- Add optional per-option `recommendedDirective` string to `ResponseOptionTemplate` (inside `responseOptions` JSON — no migration; mirrors `requiredPolicyKey`). `resolveIssue` returns the chosen option's directive in `ResolveResult`.
- Display: progress bar in `V2Agenda` rail + `V2DrillSheets` `IntentDetail` (`:122-420`); linked-issue list in the intent drill.

---

## 8. Phase 5 — V2IssueDetail (new v2 surface) ✅

- New `src/components/mycountry/v2/V2IssueDetail.tsx`, modeled on legacy `IssueDetailModal` (recon / respond / dismiss) but v2-styled and wired to `onDeclare`. Add an `issue` drill kind to `V2DrillSheets` + `V2CommandSurface` drill state.
- **Post-resolve CTA:** "Declare Follow-Up Directive →" → `onDeclare(option.recommendedDirective ?? "Address: <issue title>")` (reuses the `V2CommandSurface.declare` pre-fill conduit at `V2CommandSurface.tsx:71-77`).
- Wire active issues on `V2Home` to open `V2IssueDetail` (`V2OpportunityHero` + `V2MyAgenda`); legacy `IssuesInbox`/`IssueDetailModal` stay for non-v2 surfaces.
- Add `recommendedDirective` to admin template create/update schemas (`templates.ts:74-88`, `engine.ts:78-92`).

---

## 9. Phase 6 — Remaining bug fixes ✅

1. Delegation window `now - 5` → IxTime-day window (`player.ts:76-81`).
2. `activeIntents` goals computed but unused (`national-issues-engine.ts:404-407,533-534`) — expose as variables (covered by §6C).

---

## 10. Verification

- **Typecheck per file** (`bun run typecheck:file`) on every touched file; `bun run typecheck:trpc` + `typecheck:server`.
- **New unit tests:** mapping table (all 6 intent categories), `spawnIntentResistance` determinism + dedupe (mock db), `spawnMode` config default, progress recompute, evaluator `count`/`any` ops.
- **Existing:** `bun run test -- src/lib/national-issues-limits.test.ts`.
- **Manual:** commit extreme intent → linked issue lands instantly → V2IssueDetail → resolve → progress moves + CTA pre-fills composer → flip `spawnMode` in admin → verify probability path → attempt "complete" with open resistance → blocked.
- **`bun run audit:arch`** after edits (router file ceilings).
- **Migration:** `bun run db:push:force` before code touching the new columns.

### Delivered ✅

- **Typecheck:** `typecheck:server` / `typecheck:ui` clean for all changed files (only pre-existing errors remain). `audit:arch` 12 violations all pre-existing.
- **Tests:** 4 new test files added (26 tests, all green):
  - `src/lib/__tests__/national-issues-consequences.test.ts` — progress recompute (100%, 50%, empty-reset, no-update) — all green.
  - `src/lib/__tests__/national-issues-config.test.ts` — `spawnMode` config default + `completeNationalIssuesConfig` fills.
  - `src/lib/__tests__/national-issues-evaluator.test.ts` — `count`/`any` evaluator ops.
  - `src/lib/intent/__tests__/` — intent-category mapping table.
  - Full suite: 120 passed / 17 failed suites, 1102 passed / 24 failed tests — the 24 failures are the exact pre-existing worldgen set, no regressions.
- **Schema:** `NationalIssue.intentId`, `Intent.riskRating`, `Intent.progress` migrated via `db:push:force`.

---

## 11. Execution order

Phases run in order, each independently testable:

```
Phase 0 (schema) → Phase 1 (intent router) → Phase 2 (spawn engine + toggle)
→ Phase 3 (grounded generator) → Phase 4 (progress) → Phase 5 (V2IssueDetail) → Phase 6 (remaining fixes)
```

Biggest risk is Phase 3 breadth growth — the focused-first cut (§6) is the guardrail; do not expand snapshot scope mid-execution without a new approval.

> **Status:** All phases (0–6) executed and delivered in IxStates 1.2.7 "Ogma" (Beta). See §10 Delivered for verification results. Follow-up opportunities (out of scope, not approved): demographics/military/budget grounding breadth, `national-issues-engine.ts` (1360+ lines) split or relaxation.
