# IxStates Documentation Hub

The index for IxStates architecture, systems, operations, specifications, reference and research. Version information
comes from the [Version Registry](../src/lib/buildVersion.ts) — see [Versioning & Release Architecture](reference/revision.md).

> Audited 2026-09-29 against the code — platform **IxStates 1.4.0 "Lobster Crosby"** (Release Candidate), on the
> nightly branch `rose-garden` (branches: `rose-garden` nightly → `development` stable-experimental → `master`
> production; see [contributing](processes/contributing.md#branches)). Every doc below was checked claim by claim; statuses reflect the code, not earlier plans.
> Implementation plans live in `plans/` and completion records in `docs/archive/` and `plans/archive/`. All three are
> git-ignored and exist only in the maintainer's local checkout.

---

## 🗺️ Start here

- **What's live** — [systems/SYSTEM_STATUS.md](systems/SYSTEM_STATUS.md)
- **The roadmap** — [roadmap/ROADMAP.md](roadmap/ROADMAP.md) (milestones M0–M7, dependencies, owner decisions)
- **What's pending** — [roadmap/pending-features.md](roadmap/pending-features.md) (doc-based backlog) · [roadmap/code-audit-2026-09-30.md](roadmap/code-audit-2026-09-30.md) (code-level findings, incl. security and economy exploits)
- **Platform overview** — [overview/platform.md](overview/platform.md)
- **Local dev setup** — [operations/local-dev-setup.md](operations/local-dev-setup.md)
- **Production deployment** — start with the [release guide](operations/release-guide.md) (pre-deploy checklist, build and deploy from `master`, verify, rollback) · reference: [operations/deployment.md](operations/deployment.md) · September runbook: [operations/deploy-rose-garden-2026-09.md](operations/deploy-rose-garden-2026-09.md)
- **API catalog (77 routers, ~960 procedures)** — [reference/api-complete.md](reference/api-complete.md)
- **Database (18 schema files, 332 models)** — [reference/database.md](reference/database.md)
- **Facet design system** — [Facet 3 reference](reference/facet-design-system.md) · [spec & decisions](specs/2026-09-30-facet-3-design-system.md) · [style audit](audits/FACET_STYLE_AUDIT_2026-09-30.md) · [reference/ui-cheatsheet.md](reference/ui-cheatsheet.md)

Status key used below: ✅ Live · 🟡 Partial · 🔒 Premium · 🧪 Labs · 📐 Design / spec · 🗄️ Historical

---

## 🏛️ Architecture & core engineering

| Document | Purpose & scope |
| --- | --- |
| [architecture/frontend.md](architecture/frontend.md) | Next.js 16 App Router, providers, component layers, hubs, Facet rules |
| [architecture/backend.md](architecture/backend.md) | tRPC builders and middleware (`src/server/api/trpc/`), router composition, rate limiting, auth context |
| [architecture/data.md](architecture/data.md) | Prisma schema domains (18 files), PostGIS, `db.ts` guards, seeders |
| [architecture/autosave.md](architecture/autosave.md) | `useGenericAutoSync` engine and where it is (and isn't yet) used |
| [architecture/caching.md](architecture/caching.md) | Cache layers in `src/lib/cache/`, Redis-backed tRPC cache, wiki caches |
| [architecture/realms-framework-spec.md](architecture/realms-framework-spec.md) | Realms — separate worlds; Phase 1 shipped, Phases 2–4 pending |
| [architecture/ts-graph-isolation.md](architecture/ts-graph-isolation.md) | Partitioned typechecks (`typecheck:ui`, `server`, `trpc`, `db`) and the arch guard |

---

## ⚙️ Systems

### 🏛️ MyCountry — executive simulation
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Command Suite** | [systems/mycountry.md](systems/mycountry.md) | Command surface, directives, national issues, CivCap, meetings, gating | ✅ Live (meetings schedule-only) |
| **Country Builder** | [systems/builder.md](systems/builder.md) | Builder v4: 4-step wizard, wiki import, edit mode | ✅ Live |
| **Economy** | [systems/economy.md](systems/economy.md) · [systems/calculations.md](systems/calculations.md) | Indicators, fiscal policy (42 engine tax components), archetypes, vitality and reference formulas | ✅ Live |
| **Diplomacy** | [systems/diplomacy.md](systems/diplomacy.md) | Embassies, alliances, cultural exchange, stances with drift | ✅ Live |
| **Politics & Elections** | [systems/elections.md](systems/elections.md) | Parties, legislatures, bills, power brokers, elections | 🟡 Partial (follow-up elections broken) |
| **Defense** | [systems/defense.md](systems/defense.md) | Branches, units, procurement, readiness, threats | 🔒 Premium |
| **Intelligence** | [systems/intelligence.md](systems/intelligence.md) | Where recon and fog live now; no standalone dashboard | 🟡 Partial |
| **Synergies** | [reference/synergies.md](reference/synergies.md) | 45 additive + 45 conflicting government component relationships | ✅ Live |
| Statecraft vision audit | [systems/statecraft/mycountry-vision-audit.md](systems/statecraft/mycountry-vision-audit.md) | June 2026 audit of the vision vs the build | 🗄️ Historical |
| Statecraft game loops | [systems/statecraft/statecraft-game-loops.md](systems/statecraft/statecraft-game-loops.md) | IN → SEE → OUT → RIPPLE loop design | 📐 Design (partly built) |
| Design philosophy & PRDs | [systems/mycountry-design-philosophy-and-prds.md](systems/mycountry-design-philosophy-and-prds.md) | Design bible and statecraft PRDs, with a status matrix | 📐 Design (partly built) |

### 🌍 Atlas & Realms — geography and worlds
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Maps & map editor** | [systems/maps.md](systems/maps.md) · [app README](../src/app/maps/README.md) | `/maps`, `/admin/maps/editor`, pipelines, layers, overlays, geo routers | ✅ Live (inspector spec partial) |
| **Worldgen (UPG v2)** | [src/lib/worldgen/README.md](../src/lib/worldgen/README.md) | Procedural mesh, terrain, hydrology, climate, export | ✅ Live |
| **Realms & Eurth** | [architecture/realms-framework-spec.md](architecture/realms-framework-spec.md) · [realms/eurth-onboarding.md](realms/eurth-onboarding.md) | Ownership, claims, realm hubs, realm-scoped listings; Eurth runbook | ✅ Phase 1 · ⛔ Phases 2–4 |
| Map editor improvements | [systems/map-editor-improvements-overview.md](systems/map-editor-improvements-overview.md) | June–August editor plans (all shipped or superseded) | 🗄️ Historical |

### 📖 WikiOS — lore platform
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Native lore engine** | [systems/wikios.md](systems/wikios.md) · [systems/wikios/WIKIOS.md](systems/wikios/WIKIOS.md) | PostgreSQL store, inbound MediaWiki sync, Plate Canvas editor, `?source=` multi-wiki | ✅ Live |
| **Margin** | [systems/wikios/wikios-margin-spec.md](systems/wikios/wikios-margin-spec.md) | Inline notes, markup, gutter pins | 🟡 Partial |
| **Stash** | [systems/stash.md](systems/stash.md) · [systems/stash-style-guide.md](systems/stash-style-guide.md) | Save articles, quotes, images and threads | 🟡 Partial (no sharing) |
| **Lore lifecycle** | [systems/lore-lifecycle.md](systems/lore-lifecycle.md) | Drafting → publishing → Lorewards (`/util/lorewards`) | ✅ Live |
| WikiOS style guide | [systems/wikios/style-guide.md](systems/wikios/style-guide.md) | WikiOS tokens and typography | ✅ Live |
| Stage 3 config plan | [systems/wikios/wikios-stage3-config-plan.md](systems/wikios/wikios-stage3-config-plan.md) | MediaWiki render-service isolation | 📐 Staged, not cut over |
| Independence 2b/3 | [systems/wikios/wikios-independence-2b-3.md](systems/wikios/wikios-independence-2b-3.md) | Stage 2b (shipped) and Stage 3 proposal | 🗄️ Historical after Stage 3 |
| Longevity workflow | [systems/wikios/wikios-longevity-workflow.md](systems/wikios/wikios-longevity-workflow.md) | Portability rules; Workstream C not started | 🗄️ Historical |

### 💎 Vault — credits, cards, achievements
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Vault hub** | [systems/myvault.md](systems/myvault.md) | Dashboard, Cards, Marketplace, Import; admin toggles | ✅ Live |
| **Cards & packs** | [systems/cards.md](systems/cards.md) | 5 card types, rarity, 20 seeded packs, crafting, junking | 🟡 Partial (pack guarantees, crafting broken) |
| **IxCredits** | [systems/ixcredits.md](systems/ixcredits.md) | Ledger, passive income, daily streak, bonuses, fees | ✅ Live |
| **Achievements** | [systems/achievements.md](systems/achievements.md) | 76 achievements, leaderboards | ✅ Live (evaluated on page visit) |
| **NationStates bridge** | [systems/ns-integration.md](systems/ns-integration.md) | Deck import, verification, dump sync, image proxy, takedowns | ✅ Live |
| **Premium tiers** | [reference/premium-features.md](reference/premium-features.md) | Planned tiers; only Defense gating is enforced | 🟡 Partial |

### 💬 ThinkPages — social
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Feed & accounts** | [systems/social.md](systems/social.md) | Posts, reactions, polls, hashtags, personas, Discord mirror | ✅ Live |
| **ThinkTanks** | [systems/thinktanks.md](systems/thinktanks.md) | Group feed and members; docs and chat pending | 🟡 Partial |

### 🗨️ Forum & identity
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **IxForum** | [systems/forum.md](systems/forum.md) | XenForo bridge: read, write, stash, IxnayID account linking | ✅ Live |

### ⚙️ Concord — living world
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **IxTime** | [systems/ixtime.md](systems/ixtime.md) | World clock, epoch maths, bot sync | ✅ Live |
| **Crisis events** | [systems/crisis-events.md](systems/crisis-events.md) | Read-only today; lifecycle and responses planned | 🟡 Partial |
| **NPC personality AI** | [systems/npc-ai.md](systems/npc-ai.md) | 8 traits; drives cultural-exchange responses; drift not wired | 🟡 Partial |

### 🎨 Design, overlay & admin
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Facet** | [reference/facet-design-system.md](reference/facet-design-system.md) | Facet 3: colour roles, tints, text styles, materials, primitives, presentation, sound, accessibility | ✅ Live (Phases 1–2) |
| **Halo** | [systems/halo.md](systems/halo.md) | Contextual overlay, plugins, `Cmd+K` palette | ✅ Live |
| **Admin CMS** | [systems/admin-cms.md](systems/admin-cms.md) · [app README](../src/app/admin/README.md) | 39 admin sections, reference catalogs, RBAC; the audit log currently persists nothing (PL-1) | 🟡 Partial |
| **Help center** | [systems/help.md](systems/help.md) · [app README](../src/app/help/README.md) | Markdown help in `src/content/help/` | 🟡 Partial |

### 🧪 Labs
| System | Document | Scope | Status |
| :--- | :--- | :--- | :---: |
| **Onoma** | [systems/onoma-brand-guide.md](systems/onoma-brand-guide.md) · [roadmap](systems/onoma-roadmap.md) · [glyphs](systems/onoma-glyph-spec.md) · [voice](systems/onoma-voice-guide.md) | Naming and conlang studio, Kokoro TTS | 🧪 Labs |
| **MyLeague & MyClub** | [systems/myleague.md](systems/myleague.md) · [top-5 features](systems/myleague-top5-features.md) · [lore integration](systems/myleague-lore-integration.md) | 7-sport league simulation at `/myleague`, `/myclub` | 🧪 Labs |
| **Vexel** | [specs/vexel-prd.md](specs/vexel-prd.md) | Heraldry studio at `/labs/vexel` | 🧪 Labs (not in menu) |

---

## 📋 Specifications & PRDs

| Document | Scope | Status |
| --- | --- | :---: |
| [superpowers/specs/2026-09-27-realms-foundation-design.md](superpowers/specs/2026-09-27-realms-foundation-design.md) | Realms Phase 1 foundation | ✅ Implemented |
| [superpowers/specs/2026-09-28-realms-eurth-design.md](superpowers/specs/2026-09-28-realms-eurth-design.md) | Eurth first-realm slice | ✅ Implemented |
| [superpowers/specs/2026-09-12-route-travel-time-design.md](superpowers/specs/2026-09-12-route-travel-time-design.md) | Route travel time | ✅ Implemented |
| [superpowers/specs/2026-09-11-map-editor-properties-history-deep-overhaul-design.md](superpowers/specs/2026-09-11-map-editor-properties-history-deep-overhaul-design.md) | Map editor inspector and history | 🟡 Partial |
| [superpowers/specs/2026-09-08-builder-unified-companion-guide-design.md](superpowers/specs/2026-09-08-builder-unified-companion-guide-design.md) | Builder companion guide | 🟡 Mostly implemented |
| [specs/2026-09-30-facet-3-design-system.md](specs/2026-09-30-facet-3-design-system.md) | Facet 3 unified design system (HIG foundations, roles, type, shape, materials, components, rollout) | 🟡 Phases 1–2 shipped; navigation and app migration pending |
| [specs/2026-08-13-ixcards-lore-first-rebuild.md](specs/2026-08-13-ixcards-lore-first-rebuild.md) | IxCards lore-first rebuild | 🟡 Phases 1–5 done; 6–7 pending |
| [specs/2026-08-10-achievements-ribbons-design.md](specs/2026-08-10-achievements-ribbons-design.md) | Achievements ribbons | 🟡 Ribbons pending |
| [specs/vexel-prd.md](specs/vexel-prd.md) | Vexel heraldry studio | 🟡 P0 mostly built |
| [specs/mysports-v0.md](specs/mysports-v0.md) | MySports architecture reference | 🟡 Partly built |
| [specs/myleague-v1-prd.md](specs/myleague-v1-prd.md) | Original MyLeague scoping PRD | 🗄️ Superseded |

---

## 🛠️ Operations & processes

| Document | Focus |
| --- | --- |
| [operations/local-dev-setup.md](operations/local-dev-setup.md) | WSL2 dev environment, DB sync from production, dev scripts |
| [operations/deployment.md](operations/deployment.md) | Production reference: PM2 apps (web, ws, cron), env vars, health checks |
| [operations/deployment-checklist.md](operations/deployment-checklist.md) | Pre-flight and post-deploy procedure |
| [operations/release-guide.md](operations/release-guide.md) | Release guide: pre-deploy checklist, build and deploy from `master`, verification, rollback, and this release's one-off steps |
| [operations/deploy-rose-garden-2026-09.md](operations/deploy-rose-garden-2026-09.md) | Release runbook for rose-garden (Realms schema push, backfill, Eurth) |
| [operations/credentials.md](operations/credentials.md) | Credentials and environment variables |
| [operations/rate-limiting.md](operations/rate-limiting.md) | Rate-limit tiers, identity and coverage (sketches marked) |
| [operations/monitoring.md](operations/monitoring.md) | Logging, Discord alerts, health endpoints |
| [operations/huggingface-spaces-guide.md](operations/huggingface-spaces-guide.md) | Kokoro TTS on a Hugging Face Space |
| [processes/testing.md](processes/testing.md) | Jest strategy, quarantine CI, typecheck partitions |
| [processes/contributing.md](processes/contributing.md) | Code style, PR lifecycle, branch conventions (`rose-garden`) |
| [processes/dev-onboarding.md](processes/dev-onboarding.md) | New-developer onboarding |
| [processes/refactoring.md](processes/refactoring.md) | Modular patterns, file-size ceilings, router-split recipe |
| [../scripts/README.md](../scripts/README.md) | Scripts catalog |

---

## 📚 Reference

| Document | Topic |
| --- | --- |
| [reference/api-complete.md](reference/api-complete.md) | tRPC catalog (generated inventory + per-procedure catalog) |
| [reference/database.md](reference/database.md) | Prisma models, relations, PostGIS |
| [reference/revision.md](reference/revision.md) | Versioning & release architecture |
| [reference/events.md](reference/events.md) | WebSocket channels, SSE, cron jobs, notification registry |
| [reference/edge-cases.md](reference/edge-cases.md) | Edge-case handling (some sections describe intended design; marked) |
| [reference/branding.md](reference/branding.md) | Brand catalog — systems, icons, typography, tokens |
| [reference/facet-design-system.md](reference/facet-design-system.md) | Facet 3 design system reference |
| [reference/ui-cheatsheet.md](reference/ui-cheatsheet.md) | Frontend recipes and anti-pitfall guide |
| [reference/admin-endpoint-security-map.md](reference/admin-endpoint-security-map.md) | Admin procedures, middleware chain, RBAC |
| [reference/oceanography-report.md](reference/oceanography-report.md) | Ocean basins, currents, shipping routes |
| [reference/caphiria-geographical-report.md](reference/caphiria-geographical-report.md) | Caphiria physical geography |
| [reference/user-profile-utils.md](reference/user-profile-utils.md) | 🗄️ Obsolete — the module was deleted in June 2026 |

---

## 🔍 Audits

Point-in-time audits. Each opens with a "Status (2026-09-29)" block of resolved and open items; open items are rolled
into [roadmap/pending-features.md](roadmap/pending-features.md).

| Document | Topic |
| --- | --- |
| [audits/AUDIT_2026-09-23_bloat-slop.md](audits/AUDIT_2026-09-23_bloat-slop.md) | Bloat and design-slop audit behind plans 341–346 |
| [audits/HEX_COLOUR_INVENTORY_2026-09-27.md](audits/HEX_COLOUR_INVENTORY_2026-09-27.md) | Hard-coded colour inventory |
| [audits/src-monolith-candidates.md](audits/src-monolith-candidates.md) | Files ≥800 lines (recomputed) |
| [audits/AUDIT_2026-06-13.md](audits/AUDIT_2026-06-13.md) · [audits/AUDIT_2026-06.md](audits/AUDIT_2026-06.md) | June architecture audits |
| [audits/REFACTOR_PLAN_2026-06.md](audits/REFACTOR_PLAN_2026-06.md) | June refactor plan (all items resolved) |
| [audits/test-suite-audit-and-justification.md](audits/test-suite-audit-and-justification.md) | Test-suite inventory (removals done) |

---

## 🔬 Research & player feedback

| Document | Topic |
| --- | --- |
| [research/community-feedback-analysis.md](research/community-feedback-analysis.md) | Player feedback analysis behind the Statecraft loop |
| [systems/community-feedback-audit.md](systems/community-feedback-audit.md) | How the feedback was addressed in code |
| [research/sports-llm-commentary.md](research/sports-llm-commentary.md) | LLM match commentary (implemented) |
| [research/chatgpt-logs.md](research/chatgpt-logs.md) | Historical architecture transcript |
| [research/community-logs.md](research/community-logs.md) | Community discussion and playtest logs |

---

## 🗄️ Historical archive (`docs/archive/`)

Completed plans, spike records and legacy changelogs live in `docs/archive/`, which is git-ignored (local only, not in
the repository):
- **Superpowers brainstorming archive**: `docs/archive/superpowers/` (plans and design specs from June–August 2026).
- **Design spikes**: `docs/archive/design/` (`province-generator.md`, `territory-brush.md`).
- **Legacy changelog**: `docs/archive/CHANGELOG_PRE_OGMA.md` (v0.9 to v2.2.0).
- **Command Surface migration record**: `docs/archive/mycountry-v2-command-surface-plan.md`.
- **Pre-UPG v2 maps spec**: `docs/archive/maps-1.1.md`.
