# WikiOS Longevity & Packaging — Workflow

> **Retired 2026-10-05** to [docs/history/](../../README.md). The round is complete; Workstream C is tracked in [backlog.md](../../../roadmap/backlog.md).

**North star:** WikiOS becomes a **packageable, licensable wiki frontend** other worldbuilding
communities can deploy, backed by a **small headless MediaWiki core** (render + templates + Lua only).
MediaWiki usage minimized; WikiOS isolated and independent.

> **Status (September 29, 2026).** Agent A / Stage 2b **shipped** (PostgreSQL-first store, `WikiRevision`,
> recent-changes sync in `src/lib/wiki-os/services/auto-sync-service.ts`). Agent B / Stage 3 planning is
> **done** ([`wikios-stage3-config-plan.md`](../../../systems/wikios/wikios-stage3-config-plan.md), which lives in `docs/systems/wikios/`,
> not `plans/`), but the cutover has **not** happened. **Workstream C (packaging) has not started**: there is
> no `plans/wikios-workstream-c-packaging.md` in the repo, and WikiOS still depends on Clerk, IxStats Postgres,
> and IxStats routers. The integration branch is now `rose-garden` (the `v2` references below are historical).

## Three coupling axes (be honest about scope)

| Axis | What it means | This workflow |
|------|---------------|---------------|
| **WikiOS ↔ MediaWiki** | reads/writes/rendering through MediaWiki | Stages 2b + 3 (below) |
| **WikiOS ↔ IxStats** | Clerk auth, IxStats Postgres, `MyCountry`/`CountryData`/`BusinessData` templates, IxTime, Facet, intermixed tRPC | **Workstream C — not started** (the planned `plans/wikios-workstream-c-packaging.md` was never added). The bigger packaging blocker. |
| **Hard ceiling** | the wikitext + Lua parser | never reimplemented; stays in the headless MediaWiki core |

2b + 3 shrink MediaWiki to a headless core. **C is what actually makes WikiOS liftable into another
community's stack** (swap Clerk for any auth, make the country/stat templates optional plugins,
own DB schema, themeable). Do C as its own track once 2b/3 land.

## Portability rules (apply to ALL WikiOS work from here on)

1. **No hard-coded `ixwiki.com`.** All MediaWiki endpoints via `WIKIOS_MEDIAWIKI_API` /
   `NEXT_PUBLIC_MEDIAWIKI_URL` env (already the pattern; `WIKIOS_PARSOID_URL` is no longer read). New code must follow it.
   Known exceptions: `transformers/html-transformer.ts` rewrites asset URLs to a literal `https://ixwiki.com/`, and about 48 other non-comment `ixwiki.com` references remain across ~21 WikiOS files (e.g. `write-service.ts`, `csrf-cache.ts`, `parsoid.ts`, `pg-reader.ts`, `image-url.ts`, the `wiki/layout.tsx` canonical).
2. **No new IxStats-specific coupling** in WikiOS code. Country/stat templates are an IxStats
   *plugin*, not core wiki behavior — keep them behind the existing `MyCountry:`/`CountryData:`/
   `BusinessData:` prefix checks, isolated.
3. **WikiOS-native data stays in `prisma/schema/wiki.prisma`** and the `wikios`/`wiki`/`lorewards`/
   `blurbs` routers — don't reach into unrelated IxStats models.
4. Config-driven, not code-driven. A new community should configure, not fork-and-edit.

## Parallel execution (this round)

Two independent workstreams, dispatched as background subagents. They don't touch the same files.

### Agent A — Stage 2b: local revisioned store + dual-write + direct-edit capture (app code)
- `WikiRevision` model; dual-write on save (MediaWiki edit + Postgres revision); read-through for
  history/diff/revision-content; **recentchanges sync job** capturing edits made directly on
  MediaWiki (user confirmed: yes, capture these).
- Branch `v2`. Tests. **No prod schema push, no commit** — human reviews + pushes.

### Agent B — Stage 3: render-service isolation (planning only)
- Enumerate every MediaWiki URL/endpoint the app calls; classify headless-required vs UI-only.
- Produce `plans/wikios-stage3-config-plan.md` (now `docs/systems/wikios/wikios-stage3-config-plan.md`): nginx allow/deny/redirect ruleset + `LocalSettings.php`
  changes + rollback. **Read-only on all source/config; writes only to `plans/`. No production changes.**

## Review gates (non-negotiable)
- **No production config change** (nginx / LocalSettings / MediaWiki) ships without explicit human go-ahead.
- **No prod DB schema push** by an agent — human runs `db:push:force` after reviewing the `migrate diff`.
- Agents run oxlint on touched files + targeted jest; **never** global `tsc`/`typecheck:full`.
- Human integrates: review both agents' output → push 2b schema → decide Stage 3 rollout.

## Sequencing
1. **Now:** A and B in parallel (A builds, B plans).
2. **On A done:** review → `db:push:force` → smoke-test getWikitext/history/diff + sync job.
3. **On B done:** review config plan → enumerate-and-allowlist sign-off → stage Stage 3 behind a test vhost → cut over.
4. **Then:** scope Workstream C (IxStats decoupling) — the real packaging work.
