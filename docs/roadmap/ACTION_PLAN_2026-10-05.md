# Documentation Audit & Action Plan (2026-10-05)

**Baseline:** `rose-garden` @ `0fb3d6d` (1.4.0 "Lobster Crosby", Release Candidate) · **Method:** five parallel
read-only audits covering every tracked `.md` file, checked claim by claim against the code. The highest-impact findings
were re-checked by hand. Where the docs and the code disagree, the code wins.

This page does two things:

1. It records what is wrong with the documentation today.
2. It turns that, plus the parts of [ROADMAP.md](ROADMAP.md) that are still open, into an ordered list of actionable
   work.

It does not replace ROADMAP.md (the milestone plan) or [SYSTEM_STATUS.md](../systems/SYSTEM_STATUS.md) (what is live).
It is the to-do list that gets both of them back in step with the code. Item IDs (`MC-`, `AT-`, `WK-`, `VT-`, `SL-`,
`PL-`) refer to [code-audit-2026-09-30.md](../history/roadmap/code-audit-2026-09-30.md).

**Size:** S under a day · M 1–3 days · L more than 3 days. **Priority:** P0 now · P1 this cycle · P2 when capacity allows.

## Progress (end of 2026-10-05)

All five phases were worked the same day on `rose-garden`; the commits and merges are in `git log`. What is left:

- **Owner and ops actions (0.3):** rotate the leaked database password, check the IxWiki bot grants, run
  `audit:vault-exploits:apply` and a production restore test, run the deploy-time backfills
  (`db:mark-match-revenue-collected`, `db:backfill-transport-realm`, `bun prisma/seeds/achievement-cards.ts`).
- **Decisions:** D18 (get `.github/` onto `master` so Dependabot and scheduled workflows use the fixes). Decided on
  2026-10-06: D2 (a) restore unit authoring, D3 (b) via D20, D5 (a) build the Exchange, D9 approved after the restore
  test, D10 retire the narrator, D11 delete scheduled changes, D20 merge PR #52 (cutover later).
- **Signed off by the owner (2026-10-05):** annual policy upkeep, the stability policy scale (×10), Vexel attach (now
  renders on save), notification preferences applying to saved rows, and the earnings kill switch also blocking
  auctions, trades and junking. Crafting is deprecated for now (the workbench and recipes are off); D6 and "failed
  crafting rolls consume materials" are moot.
- **Engineering still open:** Vexel PNG rendering;
  crisis-event producer and meeting decisions on the event spine (M4); M3–M7 as planned. The live backlog is
  [backlog.md](backlog.md).
- **Ops still open:** deploy 1.4 (runbook), Redis on in production, remove the nginx CSP override, run the web process
  under PM2 if wanted, enable cron jobs one per cycle.

## Contents

- [Summary](#summary)
- [Phase 0 — This week: security, red CI, owner actions](#phase-0--this-week-security-red-ci-owner-actions)
- [Phase 1 — Make the docs true](#phase-1--make-the-docs-true)
- [Phase 2 — Release & operations baseline (rest of M1)](#phase-2--release--operations-baseline-rest-of-m1)
- [Phase 3 — Everything on screen works (rest of M2)](#phase-3--everything-on-screen-works-rest-of-m2)
- [Phase 4 — Consolidate the documentation set](#phase-4--consolidate-the-documentation-set)
- [Phase 5 — Fill documentation gaps](#phase-5--fill-documentation-gaps)
- [Later milestones (M3–M7)](#later-milestones-m3m7)
- [Decisions needed](#decisions-needed)
- [Appendix A — Done in code, still open in the roadmap](#appendix-a--done-in-code-still-open-in-the-roadmap)
- [Appendix B — Doc-by-doc corrections](#appendix-b--doc-by-doc-corrections)

---

## Summary

- **The planning docs are behind the code.** PR #49 (merged 2026-09-30) closed seven audit loops, among them first
  elections, the stat-progression job, the diplomacy inbox, mention notifications, trending, the passport showcase and
  the realm nation switcher. SYSTEM_STATUS.md picked these up. ROADMAP.md, pending-features.md and the platform audit's
  status section did not. About 30 roadmap items are done in code but still listed as open
  ([Appendix A](#appendix-a--done-in-code-still-open-in-the-roadmap)).
- **CI is red on documentation.** The blocking `docs:check` step fails: the generated blocks in `README.md`,
  `docs/overview/platform.md` and `docs/reference/api-complete.md` still show Halo v5, Facet v3.1 and 925 endpoints.
  The registry says Halo 6, Facet 4, and there are 922 endpoints.
- **The audit found one new security hole:** server-side request forgery (SSRF) plus an API-key leak in sports match
  commentary ([0.1](#01-security)). There are also several admin-named endpoints with no admin gate.
- **The setup and operations docs fail in practice:**
  - `bun run db:setup` always fails.
  - The rollback script can't find the backups that deploys write.
  - The staging deploy targets the production checkout.
  - Three cron jobs added in #49 are in no doc, so operators will never enable them.
  - A new contributor can't get from clone to a running app without a production database dump.
- **There are too many overlapping planning docs:** ROADMAP, pending-features, code-audit, the 7-file platform audit
  and SYSTEM_STATUS were all written within two days, and nothing links to the platform audit. Phase 4 cuts this to one
  plan, one backlog and one status page.
- **Fixes on `rose-garden` don't reach the parts GitHub reads from `master`.** The 1.4 promotion PRs (#44, #45) were
  closed without merging. Dependabot config and scheduled workflows are read only from the default branch, so the
  "Dependabot targets rose-garden" and "skip Gemini" fixes have no effect yet. The five Dependabot PRs opened today
  (#53–#57) all target `master`.

---

## Phase 0 — This week: security, red CI, owner actions

### 0.1 Security

| # | Item | Evidence | Size | P |
|---|---|---|---|---|
| 1 | **SSRF and key leak in match commentary.** `generateMatchCommentary` is a `publicProcedure` mutation that accepts `config.apiUrl` / `config.apiKey` and passes them to `generateAudioBroadcast`. That function POSTs to the caller's URL with `Authorization: Bearer ${SPORTS_TTS_API_KEY}` when no key is supplied. `force: true` also lets anyone re-run paid LLM calls with no limit. **Fix:** drop the client `config` from the public input (or admin-gate it), allowlist TTS hosts the way the LLM path does, and make `force` owner-only and rate-limited | `src/server/api/routers/sports/leagues/schedule.ts:193`, `src/lib/sports/commentary/narrator.ts:303-330` | S | P0 |
| 2 | **Admin-named endpoints without an admin gate.** Gate these with `adminProcedure` or rename them | `lorewards/admin.ts:124` `getCrossValidationHistory` (public), `:157` `getBlacklist` (protected), `sports/leagues/admin.ts:15` `getAdminGlobalStats` (protected) | S | P0 |
| 3 | Security map for the ~190 admin-sensitive procedures **outside** the `admin.*` router. Today they are only spot-checked: for example, `realms.reviewClaim` relies on the service layer, and sports `resetSeason` / `overrideMatchResult` rely on ownership checks | [admin-endpoint-security-map.md](../reference/admin-endpoint-security-map.md) covers `admin.*` only | M | P1 |
| 4 | M0 #19 is larger than recorded: **243** unlimited mutations (234 `protectedProcedure` + 9 `premiumProcedure`), not 228. The biggest groups are sports 29, diplomacy 26, thinkpages 23, onoma 20, wikios 20 and messages 11. Migrate them, then add a test that fails on any new unlimited mutation | `src/server/api/trpc/procedures.ts:58` | M | P1 |
| 5 | Review the CSP before calling it "enforced": it allows `frame-ancestors *` on one host path, `connect-src https: wss: ws:` and `img-src http:` | `src/proxy.ts:88`, `src/lib/security/csp.ts:20` | S | P1 |

### 0.2 Green CI

| # | Item | Size | P |
|---|---|---|---|
| 6 | Run `bun run docs:sync` and commit the result. This regenerates the three stale blocks; it is the only thing failing the blocking docs step | S | P0 |
| 7 | Fix the broken imports in 7 package scripts: `set-admin-role`, `sync:owners` and `audit:country-links` (`system-owner-constants` moved to `lib/auth/`); `cleanup:logs` (`user-logger` moved to `lib/logging/`); `wiki:sync:full`, `wiki:sync:live` and `audit:wikios-db` (`lib/wiki-os/transformers/excerpt` is gone). `validate:script-targets` passes only because it checks entry files, not their imports, so extend it to type-check them | S | P0 |
| 8 | `audit:arch`'s size ratchet never fires. All 160 entries in `scripts/audit/arch-baseline.json` are `{}`, so `lines > allowed` (`scripts/audit/audit-arch.ts:309`) is always false, and 29 entries point at deleted files. Regenerate the baseline with real line counts and add a test that every value is a number | S | P0 |

### 0.3 Owner and ops actions (not code)

| # | Item | Source |
|---|---|---|
| 9 | Rotate the `ixstats_readonly` / MariaDB password that is in git history | ROADMAP M0 #16 |
| 10 | Check the IxWiki bot's grants on Special:BotPasswords | platform audit §0 |
| 11 | Run `audit:vault-exploits:apply` on production and record the result | ROADMAP M0 #17 |
| 12 | Restore a `db:backup` dump into a scratch database (the M0 exit criterion) | ROADMAP M0 #15 |
| 13 | Run `db:mark-match-revenue-collected` at the next deploy | ROADMAP M0 #13 |

---

## Phase 1 — Make the docs true

All S unless noted. One PR, preferably straight after Phase 0. The line-level list is in
[Appendix B](#appendix-b--doc-by-doc-corrections).

1. **Update the planning docs for #48, #49 and Facet 4.**
   - Mark every row in [Appendix A](#appendix-a--done-in-code-still-open-in-the-roadmap) done in ROADMAP.md, and
     narrow the partial rows.
   - Update [pending-features.md](../history/roadmap/pending-features.md): about 12 rows now contradict the code.
   - Update the platform audit §0 "still open" list.
   - Add CHANGELOG entries for #48, #49 and Facet 4 / the sidebar. The newest entry is Facet 3.
2. **Fix the counts.**
   - **Schema:** 21 schema files with **336** models, not 18 files and 332 models (`README.md:70`, `docs/README.md:23`,
     `architecture/data.md:5`, `overview/platform.md:149`, `reference/database.md`).
   - **Procedures:** there are **922**, but the docs say ~960 (`docs/README.md:22`) or ~900 (`architecture/backend.md:4`,
     `overview/platform.md:133`, `src/server/api/routers/README.md:5`). Better still, have these pages point at the
     generated block instead of repeating a number.
3. **Cron jobs.**
   - Add `stat-progression`, `thinkpages-trending` and `achievements-evaluate` (`src/server/cron/jobs.ts:205,220,231`)
     to [events.md](../reference/events.md), the release guide and the rollout order. Without them, stored stats never
     move.
   - Document `cronSchedule_statProgression` and `cronSchedule_thinkpagesTrending`.
   - SYSTEM_STATUS says "17 jobs"; there are 20.
4. **SYSTEM_STATUS.md.**
   - Facet v2 → 4, Halo v5 → 6.
   - Admin: `/admin/calculations` exists, and the audit log persists (`middleware.ts:264-305`).
   - Help center → ✅ Live: all 55 articles are registered.
   - Crafting is in the sidebar.
   - The map-editor route renders full-screen.
   - Crisis events have **no** writer at all now that the demo seed is gone.
   - `card-values` runs every 6 h and does no real work.
   - There is no `/labs` index page.
   - Change "Last verified" to today.
5. **Facet 3 → 4 everywhere.**
   - `docs/README.md` (lines 24, 112, 135, 175).
   - `systems/halo.md` (versions; `DynamicIslandEffects.tsx` is gone).
   - `systems/mycountry.md` (Facet 3.1 identity, `Eyebrow`, three deleted files).
   - Set the status lines of the two 2026-10-04 Facet 4 specs to "implemented (foundation + sidebar); per-app sweep in
     progress".
   - Point the superseded Facet 3 spec at the Facet 4 reference.
6. **Remove contradictions about ThinkTanks.** `thinktanks.md:4` and `social.md:56` say the Docs and Chat tabs are not
   mounted; both are (`ThinktankWorkspace.tsx:105-109`). Fix `eurth-onboarding.md:282-287` too: the per-realm feed
   and the nation switcher shipped.
7. **Fix the onboarding blockers in the docs** (the code fixes are in Phase 2):
   - `contributing.md:28` tells people to run `db:setup`, which can't work (see 2.1).
   - The docs disagree on the base branch: `contributing.md` says branch from `development`; `dev-onboarding.md`,
     `local-dev-setup.md` and `README.md:308` say `rose-garden`. Pick one, per decision D13.
   - `contributing.md:30` claims the local gates are "the same gates CI runs". They aren't: CI runs `test:ci`, skips
     `typecheck:db`, and has non-blocking `audit:arch` / `lint:strict`.
   - `local-dev-setup.md:229` says deploys use "whatever branch"; `deploy-production.sh` refuses anything but `master`.
   - `local-dev-setup.md:242` says Prisma doesn't load `.env`; `prisma.config.ts` does.
   - Say in the README and onboarding docs that `bun run dev` runs `db:push:force` when the schema changes.
8. **Fix the broken links.**
   - `src/lib/README.md:28` (`navigation-config.ts`).
   - `deployment-checklist.md:411` (`#platform-deployment`).
   - The builder companion spec (`EconomicWelcomeModal.tsx`).
   - The 17 CHANGELOG links to deleted files: turn them into code spans.
9. **Fix the stale feature READMEs:**
   - `src/app/admin/README.md:62` (calculations page)
   - `src/lib/README.md:68` (`src/lib/ai/`)
   - `src/app/vault/README.md:50` (`vault-type-guards.ts`)
   - `src/components/cards/crafting/README.md:82` (sidebar)
   - `src/app/mycountry/README.md:27` (watermark, tiles → peeks)
   - `src/app/(wiki-os)/README.md:48` (tilt header, sticky TOC → Inspector)
10. **Fix wrong architecture references.**
    - `backend.md:58,60` and `caching.md:39` name `cachedProtectedProcedure` / `readOnlyProcedure`, which don't exist.
    - `autosave.md` cites hooks that don't exist.
    - `frontend.md:42` names `<Navigation />`; the layout uses `AppShell`.
    - `rate-limiting.md` cites a missing test script and admin route.
    - `events.md:44` claims 35 events; the registry has 14 in 6 categories.
    - `README.md:286` (`format:write` covers no CSS) and `README.md:310` (the 700-line rule isn't enforced, and the hook
      limit is 500).

---

## Phase 2 — Release & operations baseline (rest of M1)

Verified status of every M1 item, plus new findings. Rows marked **new** are not in ROADMAP.md.

### 2.1 Repository, CI and developer setup

| Item | Status | Next action | Size |
|---|---|---|---|
| **Get the GitHub-read config onto `master`** (new) | Open | Dependabot (`target-branch`, the Gemini guard and the workflow fixes) only take effect from the default branch. Either promote rose-garden → development → master (the closed #44/#45), or cherry-pick `.github/` to `master` now. Close or retarget #53–#57 | S |
| `dependabot.yml` hygiene (new) | Open | Remove the duplicate `open-pull-requests-limit` (`:16`, `:29`) and the placeholder `security-team` reviewer (the `reviewers` key is deprecated) | S |
| Failing scheduled workflows | Partial | `security-scan.yml`: `bunx npm audit` has no lockfile; switch to `bun audit` or delete it. `image-validation.yml`: it calls the missing `scripts/validate-military-equipment-images.ts` and runs `db:push` with no DB; delete it or fix it. Gemini: the guard exists on rose-garden only (D15) | S |
| Lint blocking | Partial | The hooks errors look fixed; confirm with an oxlint run. Check that the `react-hooks/rules-of-hooks` disable comment matches the `react/` name in the config. Lower `--max-warnings` from 2100, then remove `continue-on-error` (`ci.yml:44-46`) | S |
| Typecheck coverage | Open | Add tests, `proxy.ts`, `instrumentation.ts`, `content/` and `scripts/` to a tsconfig; run `typecheck:db` in CI | S |
| Broken package scripts | Open | See Phase 0 #7 | S |
| `audit:arch` blocking | Open | After Phase 0 #8: split or relax the 8 new god files (e.g. `wikios/templates.ts` 1295 lines, `UsersPanel.tsx` 967), then remove `continue-on-error` (`ci.yml:40-42`) | M |
| CI branch list (new) | Open | `ci.yml:6` still lists the legacy `main` and `v2`; add `development` | S |
| **Dev bootstrap without production** (new) | Open | `db:setup`, `dev:db` and `fresh` all chain into the hard-blocked `db:push`. Add a `db:bootstrap` that creates PostGIS (`CREATE EXTENSION postgis`), runs `db:push:force` on an empty database, seeds, and sets an admin. Commit a `docker-compose.dev.yml` (Postgres + PostGIS + Redis). Seed demo countries so contributors don't need `dev:local`'s production dump | M |
| **Commit contributor/AI rules** (new) | Open | `CLAUDE.md`, `AGENTS.md` and `.claude/` are git-ignored, yet `dev-onboarding.md` tells people to read `CLAUDE.md`. Commit a contributor rules file (the onboarding §9 hard rules) | S |

### 2.2 Deploy and runtime

| Item | Status | Next action | Size |
|---|---|---|---|
| Deploy rose-garden via the runbook | Open (ops) | Add the three #49 cron jobs and #49's schema additions to the runbook first | M |
| **Env file load order** (new) | Open | `load-env.mjs:12` (ws, cron, server.mjs) lets `.env.production` win; `start-production.sh:31-45` lets `.env.production.local` win. The ws and cron processes can get placeholder secrets. Use one order everywhere | S |
| **`.env.example` completeness** (new) | Open | Add `WIKI_SYNC_WEBHOOK_SECRET` (the app won't boot in production without it), `NEXT_PUBLIC_APP_URL` and about 50 other `env.ts` keys. Remove the unused `DISCORD_BOT_AUTH_KEY`, `ENCRYPTION_MASTER_PASSWORD` and `NEXT_PUBLIC_C15T_URL`. Fix the header (`src/env.js` → `src/env.ts`, and drop the `plans/330` reference) | S |
| **`verify:environment` checks what production needs** (new) | Open | It checks only `DATABASE_URL` and `NODE_ENV`. Add Clerk, `CRON_SECRET`, `IXTIME_BOT_SECRET` and `WIKI_SYNC_WEBHOOK_SECRET`; better, reuse the `env.ts` schema | S |
| Redis in production | Open | `REDIS_ENABLED` defaults to `"false"` (`env.ts:36`). Add a production startup or health assertion | S |
| Market WebSocket Redis bridge | Open | Copy `thinkpages-broadcast-bridge.ts` for `auction-service.ts` | M |
| PM2 ecosystem example | Open | Commit `ecosystem.config.example.cjs` (it is where `CRON_ENABLED_JOBS` lives). Remove `\|\| true` from `pm2 startOrReload` (`deploy-production.sh:194`) | S |
| Rollback script | Open | It looks in `prisma/backups/pre-deployment-*.backup`; deploys write `backups/ixstats-*.dump`. It passes `--backup=FILE`, but `restore-db.ts` takes a positional argument plus `--yes`. It rolls back to `HEAD~1`, not a tag, and restarts with `nohup`, not PM2. Rewrite it | S–M |
| **Staging deploy** (new) | Open | `deploy-to-staging.sh:16` uses the production checkout and `db:migrate:deploy` with stale migrations. Point it at a staging checkout, or delete it and its README entry | S |
| CSP | Partial | The nonce works. Ops: remove the nginx override, then drop `'unsafe-inline'` (`csp.ts:20`); see also 0.1 #5 | S |
| nginx reference (new) | Open | Document (or commit a redacted copy of) the `/ws/thinkpages` and `/api/market-ws` proxy blocks | S |

### 2.3 Scheduled jobs

| Item | Status | Next action | Size |
|---|---|---|---|
| Cron monitoring | Open | Add a `CronRun` model, a Discord alert on failure, and the last success per job in `/api/health` (currently DB, memory and uptime only) | M |
| 1,000-row cap paging | Open | `server/db.ts:189-192` silently caps reads at 1,000. Log when the cap is hit; page through `drift-cron.ts` and `politics-drift-cron.ts` | S |
| `policy-maintenance` idempotent | Open | `maintenance-cron.ts:199-273` debits `totalBudget` on every run. Add a per-period key | S |
| Enable jobs in order | Open (ops) | Add `stat-progression`, `thinkpages-trending`, `achievements-evaluate` and `db-backup` to the documented order | S |
| Log retention job | Open | `UserLogger.cleanupOldLogs` exists (`user-logger.ts:348`) but has no caller. Add a job | S |
| Nightly backup | **Done (code)** | `db-backup` at `17 3 * * *` (`jobs.ts:241`). Enable it, then test a restore (0.3 #12) | — |
| Lease-row lock | Open | `job-lock.ts:14-35` holds an advisory lock inside a transaction for up to 60 minutes | M |
| Version registry → 1.4.x Stable | Open | `buildVersion.ts:27-31` at release | S |

**Exit (unchanged):** CI fully blocking and green; jobs enabled with alerting; nightly backups with a tested restore; CSP
enforced. **Added:** a new contributor reaches a running app from an empty database using only the repo.

---

## Phase 3 — Everything on screen works (rest of M2)

Only the items still open or partial in code are listed. Everything else in M2 is done
([Appendix A](#appendix-a--done-in-code-still-open-in-the-roadmap)).

### 3.1 Core loops

| Item | Refs | Status | What remains | Size |
|---|---|---|---|---|
| Cabinet meetings conclude | pending §2 | Open | Complete and decision mutations, with UI; `meetingDecision` is read but never written | M |
| Policy repeal, expiry, CivCap release | MC-5 | Open | Repeal mutation and UI; an expiry sweep. The `policies/index.ts:8` comment claims repeal exists, but it doesn't | S–M |
| Defense force structure | MC-3 | Open | No `militaryBranch.create` anywhere, so assets can't be created. Waits on D2 | L |
| PvP conflict resolution | MC-4 | Open | `security/conflicts.ts:188` sets conflicts `active`, and nothing resolves them | M |
| Alliance invite NPC auto-response | MC-10 | Partial | Accept, decline and withdraw are done; NPC targets never answer | S |
| Cultural exchange missions | MC-11 | Open | `exchanges/core/mutations.ts:185` creates `EmbassyMission` rows that nothing completes | S |
| Crafting | VT-14 | Partial | Grant `resultCardId` instead of minting a generic card (`recipes.ts:312`); validate criteria, not just counts (`:256`); one `successRate` unit (roll 0–100 vs schema 0–1 vs seed 95); ownership IDs (`:333`). **Deprecated 2026-10-05:** crafting is retired; D6 moot: crafting deprecated 2026-10-05 | M |
| Ledger earn gaps | VT-23 | Partial | `isEarningEnabled` exempts EARN_BONUS, EARN_CARDS and REFUND | S |
| Pack opening | VT-18 | Open | `guaranteedRarity` and `themeFilter`; exclude SPECIAL and crafted cards; a rarity fallback (`pack-service.ts:108` throws); ownership IDs (`:134`); typed errors | S–M |
| Achievement cards | VT-17 | Open | `prisma/seeds/achievement-cards.ts:11` imports a missing module, and `db:seed` doesn't call it | S |
| Store perks vanish | VT-13 | Open | `vault-perks.ts:224` `take: 100`, `:254` `isActive: true` | S |
| WikiOS edit integrity | WK-2, WK-4, WK-16, WK-3 | ✅ Done with WikiOS v1 (#52, D20, 2026-10-06; live at the cutover) | Use `basetimestamp` for conflicts (`editing.ts:102`); require and check Turnstile (`:108`); purge the cache on revert; page-protection writer, admin UI and `WikiLog` | M |
| WikiOS uploads and Commons | WK-5, WK-6 | WK-5 ✅ done with #52; WK-6 open (the picker never calls `commons.search`) | The upload sends no file buffer (`editing.ts:300`); the Commons tab has no procedure. Waits on D3; coordinate with PR #52 | M |
| ThinkTank invites | SL-13 | Partial | An invite inbox with decline; join-by-code | S–M |
| Realm data isolation | AT-1, AT-18 | Open | Set `realmId` on route and hub creates, with a backfill; scope the flag lookup to the realm | S |
| Realm-aware maps | AT-2, AT-12 | Open | IxWorld-only ocean labels and tour; a realm wiki source | S |
| Vexel attach and Labs nav | pending §2 | Open | Render a PNG, guard the empty `thumbnailUrl \|\| largeUrl \|\| ""`, add Vexel to `app-sections.ts` | M |
| Crisis events (new) | pending §3 | Open | Nothing writes `CrisisEvent` rows now that the demo seed is gone. Build the producer or hide the surface (M4) | — |

### 3.2 Fabricated data and leaks

- MC-9: a lint comment renders as text in JSX at `NotificationRow.tsx:140`.
- MC-13: stability queries write to the database (`security/stability.ts:29`, `borders.ts:31`), and `recentPolicies`
  is empty.
- MC-14: embassy tiers default to DEVELOPED (`EmbassyCard.tsx:34,102`).
- AT-17: the "Maps private beta" notice (`MapNotices.tsx:40-75`).
- AT-9: Labs enrichment is fake (`enrichment-pipeline.ts:100`); label it a demo or build it.

### 3.3 Settings that do nothing: wire or hide

All are still open: SL-4 block/mute; SL-5 notification categories and the email/push toggles; VT-9 card general
settings; VT-10 vault prices; WK-11 Stash/ThinkPages limits (`accounts.ts:164-172` hard-codes 25); WK-8 Loreward
weights; WK-14 reader toggles; WK-10 Discord feed save. **Do this first:** hide every control that isn't enforced (S),
then wire them one by one.

### 3.4 Navigation

- Topic links in `thinkpages/post/PostBody.tsx:59` still go to `/thinkpages/topic/…`, which has no route.
- WK-15: the export link has no slug (`EditorialSection.tsx:46` → 400).
- The admin `showDefenseTab` toggle is still read nowhere but `admin/users.ts`.

---

## Phase 4 — Consolidate the documentation set

Do this once Phase 1 has made the content true. Each step is S–M.

1. **One plan, one backlog, one status page.**
   - Keep `ROADMAP.md` (the plan) and `SYSTEM_STATUS.md` (what is live).
   - Fold the open rows of `pending-features.md`, `code-audit-2026-09-30.md` and `platform-audit/README.md` into a
     single backlog (`roadmap/backlog.md`), keeping the IDs.
   - Move the audits themselves, this page included once it is done, to a tracked history folder.
   - Link the platform-audit area reports from the hub until then: today nothing links to them.
2. **Choose a tracked archive policy.**
   - `contributing.md:59` says to archive into `docs/archive/`, which is git-ignored, so archived docs leave the
     repository.
   - Use a tracked `docs/history/`, and cut the hub's "Historical archive" section (`docs/README.md:212-220`) to one
     line.
   - Strip the ~30 references to `plans/` and `docs/archive/` from tracked docs, or label them as local-only.
3. **Retire obsolete docs:**
   - `reference/user-profile-utils.md` (its code was deleted in June)
   - `audits/REFACTOR_PLAN_2026-06.md` (all resolved)
   - the superseded Facet 3 spec
   - `operations/deploy-rose-garden-2026-09.md` (after the 1.4 release)
   - `audits/test-suite-audit-and-justification.md` (says itself it is stale)
   - the four docs that call themselves historical (map-editor overview, mycountry vision audit, two WikiOS longevity
     docs)
4. **Merge the overlapping clusters:**
   - **Deployment:** keep `release-guide.md` as the entry point and `deployment.md` as the reference, and fold
     `deployment-checklist.md` (860 lines) into release-guide Part A.
   - **WikiOS:** make `systems/wikios/WIKIOS.md` canonical and reduce `systems/wikios.md` to a stub. Do this after PR #52
     lands, since #52 rewrites both.
   - **Community feedback:** merge `systems/community-feedback-audit.md` into `research/`.
   - **Realms:** move `docs/realms/eurth-onboarding.md` into `systems/`.
   - **MyLeague:** one system doc; the PRDs go to `specs/` with status headers.
   - **Onoma and Stash:** use subfolders, as `systems/wikios/` does.
5. **One spec folder and naming scheme.** Move `docs/superpowers/specs/*` into `docs/specs/` ("superpowers" is the
   tool that produced them, not a subject) and rename the undated specs (`vexel-prd`, `myleague-v1-prd`,
   `mysports-v0`) to `YYYY-MM-DD-slug.md`.
6. **Add the 11 orphans to the hub:** the 7 platform-audit files (or archive them per step 1), both Facet 4 specs,
   `systems/realms.md` and `systems/ixnayid-passport.md`.
7. **Stop the drift from coming back.**
   - ~~Extend `docs:check`'s link validator from 14 in-scope docs to all of `docs/**` and `src/**/README.md`, anchors
     included.~~ Done: it covers every tracked `docs/**`, `src/**/README.md`, `scripts/**/README.md` and
     `src/content/**` file, plus `README.md` and `CHANGELOG.md`.
   - Require a `**Last updated:**` line in every `docs/` file; 47 have no date today.
   - ~~Make the hub count claims (routers, procedures, models, schema files) generated blocks, like the version
     matrix.~~ Done: inline `BEGIN_DOCS:COUNT:<key>` markers, rewritten by `docs:sync`.
   - Add the doc updates to the PR checklist for any PR that closes a roadmap ID.

---

## Phase 5 — Fill documentation gaps

| Gap | Where it goes | Size |
|---|---|---|
| Empty-DB bootstrap: PostGIS, schema push, seed, first admin, demo data (with Phase 2.1) | `operations/local-dev-setup.md`, README quickstart | S |
| PM2 ecosystem, nginx proxy blocks, `CRON_ENABLED_JOBS` location | `operations/deployment.md` | S |
| Contributor/AI rules file | repo root | S |
| Security map for admin-sensitive procedures outside `admin.*` (with 0.1 #3) | `reference/admin-endpoint-security-map.md` | M |
| System docs: Notifications, Vexel/heraldry, Explore and country profiles, Settings, ScheduledChange (or delete it, D11), demo mode | `docs/systems/` | M |
| Help articles: Blurbs, MyLeague/MyClub, Onoma, Vexel, the Canvas editor, Explore, Settings, Halo | `src/content/help/` + `help-sections.ts` | M |
| CHANGELOG entries for #48, #49, Facet 4 and the sidebar | `CHANGELOG.md` | S |

---

## Later milestones (M3–M7)

These are unchanged from [ROADMAP.md](ROADMAP.md) and were not re-verified line by line, except where #49 already
delivered part of them:

- **M3 Realms Phase 2.** #49 shipped:
  - the realm-aware builder with nation caps (part of AT-3);
  - the passport and nav nation switcher (M3 #5);
  - a `/realms` directory (part of AT-6);
  - realm boards on ThinkTanks;
  - a realm filter on the ThinkPages feed (part of M3 #10).

  Still open from #49's own list: no nav entry for `/realms`; the dashboard feed and trending are not realm-scoped.
  Re-check M3 rows 4–6 and 10 before planning.
- **M4 Statecraft.** Unchanged. Two dependencies are now met: MC-7 (history) unblocks fog bands, and MC-2 (elections)
  unblocks the legislature domain. #49 lists one bug to fold in: issue trigger conditions compare `actualGdpGrowth` as a
  percentage, but it is stored as a decimal.
- **M5 Economy.** Background achievement evaluation, achievements without a nation, and derived ribbons with a pinned
  shelf are done. What remains is the Ribbons tab, community ribbons, and everything else in M5.
- **M6 Social.** Mentions, trending, persona follows and the personal persona are done (SL-7/8/9 and SL-11 in part).
  Still open: engagement via the spine, block/mute, digests, and moderation.
- **M7 Labs.** Unchanged; sports predictions can now be placed (part of SL-15).
- **Parallel track: WikiOS v1, PR #52** (open since 2026-10-01). It touches SYSTEM_STATUS, the Facet reference and both
  WikiOS docs. Rebase it on the Phase 1 doc fixes and decide whether it supersedes WK-5, WK-6 and the Stage 3 items
  before starting them.

---

## Decisions needed

These are new or changed since [ROADMAP.md § Decisions needed](ROADMAP.md#decisions-needed); D2–D15 are otherwise
unchanged.

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 (changed) | #49 implemented scheduled first elections with party candidates (option a, 30 IxDays after setup, at least 2 parties). Seat-by-vote-share (option b) isn't built. Confirm (a), or still add (b) for legislatures with fewer than 2 parties | Confirm (a) and close D1 | M4 legislature |
| D16 | Tracked docs archive location (`docs/history/`) vs the git-ignored `docs/archive/` | Tracked `docs/history/` | Phase 4 |
| D17 | Which branch contributors start from: `development` (contributing.md) or `rose-garden` (onboarding, README) | Per D13: juniors use `development`; say it once, in contributing.md | Phase 1 #7 |
| D18 | Promote to `master` now (redo #44/#45), or cherry-pick only `.github/` | Cherry-pick `.github/` now; promote after Phase 2 | Phase 2.1 |
| D19 | The #49 tuning constants still unconfirmed: realm nation cap stays 1, 14-day proposal expiry, passport sections visible by default (including the IxC balance), ±3% / ±1% issue caps, public realm boards | Confirm them, or list overrides | Phase 1 docs |
| D20 | PR #52 (WikiOS v1) and its scope against WK-5, WK-6 and Stage 3 | **Decided (2026-10-06):** merge #52 into `rose-garden` now; the cutover is a separate deploy (its runbook) | Phase 3.1, Phase 4 #4 |

---

## Appendix A — Done in code, still open in the roadmap

Mark these done in ROADMAP.md and pending-features.md. Evidence is from the 2026-10-05 audit.

| Item | Evidence |
|---|---|
| MC-2 politics / first elections | `src/lib/government/election-lifecycle.ts`, `ElectionStatusCard.tsx` |
| MC-7 stat progression and history | `src/server/cron/stat-progression.ts`, `jobs.ts:205` |
| VT-4, VT-5 ledger consolidation | `pack-service.ts:96`, `lore-cards/user.ts:150`, `lore-cards/admin.ts:269-318` |
| VT-8 fake ribbons | `FloatingRibbonRack.tsx:125` |
| VT-11 store owned state | `VaultStoreTab.tsx:393` |
| VT-20 leaderboard defaults | `achievements/country.ts:300` |
| MC-8 embassy shared data (removed) | `sharedData.ts` deleted |
| MC-12 editorial profile prose (removed) | `EditorialProfileView.tsx` deleted |
| MC-15 budget utilisation | `BudgetAllocationForm.tsx:111` |
| AT-4 passport realm tiles | `PassportRealmsTab.tsx:178` |
| AT-13 map editor admin and route | `useEditorOverlayServices.ts:361`, `app/mycountry/map-editor/page.tsx` |
| SL-11 mention notifications | `lib/notifications/hooks.ts:148-164` |
| SL-17 standings form | `LeagueRouter.tsx:63,212` |
| SL-19 Halo sign out | `components/halo/hooks.ts:252` |
| SL-20 mark all read | `halo/views/NotificationsView.tsx:235` |
| SL-21 Create League/Club (old nav removed) | `lib/navigation/app-sections.ts:440` |
| SL-22 ThinkTank chat, and the Docs tab | `ThinktankWorkspace.tsx:105-109` |
| SL-24 `/explore` mobile filters | `app/explore/page.tsx` (Sheet) |
| SL-26 LiveDataCard | `LiveDataCard.tsx:105-125` |
| `/admin/calculations` page | `app/admin/calculations/page.tsx` |
| PL-1 audit log persists | `trpc/middleware.ts:264-305` |
| M2.5 help: registration, WK-21 and all new topic articles | `help-sections.ts` (55 of 55); `world/realms.md`, `getting-started/ixnayid.md`, `world/maps.md`, `wiki/wikios.md`, `wiki/stash.md`, `social/forum.md`, `getting-started/premium.md` |
| pending-features `db:backup` stub | `scripts/setup/backup-db.ts`, `db-backup` cron |
| Achievements: background evaluation, and without a country | `achievements-evaluate` cron (`jobs.ts:231`) |
| Per-realm feed filter; passport nation switcher | #49; `systems/realms.md:43` |
| Dead intelligence calculator (code-health item) | `lib/intelligence/calculator.ts` already deleted |

**Partly done; narrow the rows:** MC-10 (NPC auto-response left), VT-14, VT-23, SL-13, MC-9 (one text leak), topic links
(`PostBody.tsx:59` only), AT-3, AT-6.

---

## Appendix B — Doc-by-doc corrections

| Doc | Correction |
|---|---|
| `README.md` | Counts (`:69-70`); `format:write` (`:286`); the 700-line claim (`:310`); base branch (`:308`); quickstart skips DB creation and seeding (`:234-243`); generated version block (`docs:sync`) |
| `docs/README.md` | Counts (`:22-23`); Facet 3 → 4 labels (`:24, :112, :135, :175`); add the Facet 4 specs, `realms.md`, `ixnayid-passport.md` and the platform audit; archive section (`:212-220`) |
| `systems/SYSTEM_STATUS.md` | See Phase 1 #4 |
| `roadmap/ROADMAP.md`, `pending-features.md`, `platform-audit/README.md` §0 | Appendix A |
| `reference/events.md` | 3 cron jobs; "35 events" → 14 in 6 categories |
| `reference/api-complete.md`, `overview/platform.md` | `docs:sync`; counts |
| `architecture/backend.md`, `caching.md` | Procedure names that don't exist; count |
| `architecture/autosave.md` | Hooks that don't exist (`useBuilderAutoSync` etc.) |
| `architecture/frontend.md` | `<Navigation />` → `AppShell`; hook count |
| `architecture/data.md`, `reference/database.md` | 21 files, 336 models |
| `operations/deployment.md` | Merged from a doc that no longer exists (`:93`); unused `ENABLE_CACHING` / `CACHE_TTL_SECONDS` (`:116`); env load-order clash (`:24`) |
| `operations/deployment-checklist.md` | Anchor (`:411`); the unused cache vars; fold into the release guide |
| `operations/local-dev-setup.md` | Deploy branch (`:229`); Prisma env loading (`:242`); scp-from-VPS bootstrap; PostGIS step |
| `operations/rate-limiting.md` | Missing `scripts/test-rate-limit.ts` (`:501, :546`) and admin route (`:576`) |
| `processes/contributing.md` | `db:setup` (`:28`); "same gates CI runs" (`:30`); archive policy (`:59`) |
| `processes/dev-onboarding.md` | Base branch (`:147, :171, :174, :205`); `CLAUDE.md` references (`:192, :212, :224`) |
| `processes/testing.md` | "320+ files" → 546 |
| `processes/refactoring.md` | Missing `src/components/tax-system/`; the 1,000-line advice vs the 700-line ceiling; "arch guard fails CI" |
| `scripts/deployment/README.md` | The rollback and staging entries (until the scripts are fixed) |
| `reference/admin-endpoint-security-map.md` | "~270 in other routers" (`:3`) → ~190 outside `admin/` |
| `systems/halo.md` | `FACET_VERSION`, `HALO_VERSION` (`:3, :6`); `DynamicIslandEffects.tsx` (`:27`) |
| `systems/mycountry.md` | Facet 3.1 (`:45`); `Eyebrow` (`:61`); deleted files (`:70, :78, :79`) |
| `systems/calculations.md` | `atomic-tax-integration.ts` (`:184`) |
| `systems/crisis-events.md` | Deleted seed file (`:10`); no writer at all |
| `systems/thinktanks.md`, `systems/social.md` | Docs and Chat are mounted (`:4`; `:56`) |
| `systems/achievements.md` | Help route linked as a file path |
| `realms/eurth-onboarding.md` | "Not shipped yet" list (`:282-287`) |
| `specs/2026-08-10-achievements-ribbons-design.md` | Derived ribbons exist (`:10`) |
| `superpowers/specs/2026-10-04-facet-4-*.md` | Status lines (`:3`) |
| `superpowers/specs/2026-09-08-builder-unified-companion-guide-design.md` | `EconomicWelcomeModal.tsx` is gone (`:10`) |
| `CHANGELOG.md` | 17 links to deleted files; no entries for #48, #49 or Facet 4 |
| `.env.example` | See Phase 2.2 |
| `src/lib/README.md`, `src/app/admin/README.md`, `src/app/vault/README.md`, `src/app/mycountry/README.md`, `src/app/(wiki-os)/README.md`, `src/components/cards/crafting/README.md` | Phase 1 #9 |
