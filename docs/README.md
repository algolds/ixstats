# IxStates Documentation Hub

The authoritative index for all IxStates architecture, systems, operations, specifications, reference, and research. Version information is governed by the [Version Registry](../src/lib/buildVersion.ts) — see [Versioning & Release Architecture](reference/revision.md).

> Refreshed August 2026 — platform **IxStates 1.4.0 "Ogma"** (Release Candidate), branch `v2`. Treat this structure as the source of truth.  
> Active implementation plans live in [`plans/`](../plans/); historical completion records live in [`archive/`](archive/) and [`plans/archive/`](../plans/archive/).

---

## 🗺️ Quick Navigation

- **Platform Overview** — [overview/platform.md](overview/platform.md)
- **Master System Status & Going Gold Audit** — [systems/SYSTEM_STATUS.md](systems/SYSTEM_STATUS.md)
- **Statecraft Engine & Decision Simulator** — [systems/statecraft/mycountry-vision-audit.md](systems/statecraft/mycountry-vision-audit.md)
- **WikiOS Platform & Architecture** — [systems/wikios/WIKIOS.md](systems/wikios/WIKIOS.md)
- **Versioning & Release Architecture** — [reference/revision.md](reference/revision.md)
- **API Catalog (90 Routers / 1,450+ Endpoints)** — [reference/api-complete.md](reference/api-complete.md)
- **Database Schema Models** — [reference/database.md](reference/database.md)
- **Facet Design System Specification** — [reference/facet-design-system.md](reference/facet-design-system.md)
- **Maps & Geographic Engine (UPG v2)** — [systems/maps.md](systems/maps.md)
- **Local Dev Setup** — [operations/local-dev-setup.md](operations/local-dev-setup.md)
- **Production Deployment** — [operations/deployment.md](operations/deployment.md)

---

## 🏛️ Architecture & Core Engineering

| Document | Purpose & Scope |
| --- | --- |
| [architecture/frontend.md](architecture/frontend.md) | Next.js 16 App Router architecture, component layers, and Facet design rules |
| [architecture/backend.md](architecture/backend.md) | tRPC router patterns, modular sub-routers, middleware, rate limiting, and auth context |
| [architecture/data.md](architecture/data.md) | Prisma schema domains (15 schema files), PostGIS models, seeders, and data lifecycle |
| [architecture/autosave.md](architecture/autosave.md) | Universal autosave engine (`useGenericAutoSync`), debounced delta sync, and conflict handling |
| [architecture/realms-framework-spec.md](architecture/realms-framework-spec.md) | IxWorld & Realms multi-tenant platform architecture and schema isolation |
| [architecture/ts-graph-isolation.md](architecture/ts-graph-isolation.md) | TypeScript partitioned sub-project checks (`typecheck:ui`, `server`, `trpc`, `db`) and safe heap bounds |
| [architecture/caching.md](architecture/caching.md) | Multi-tier caching architecture (in-memory layer-cache, Redis rate-limiting, WikiOS shadow store) |

---

## ⚙️ Systems & Platform Pillars

| System | Document | Scope & Architecture | Launch Status |
| :--- | :--- | :--- | :---: |
| **Status Audit** | [systems/SYSTEM_STATUS.md](systems/SYSTEM_STATUS.md) | **Master System Status & Public Launch Readiness Matrix ("Going Gold")** | 📀 **Target: 1.0.0 GM** |
| **Statecraft** | [systems/statecraft/mycountry-vision-audit.md](systems/statecraft/mycountry-vision-audit.md) | **Statecraft Philosophy** — Executive decision simulator vs spreadsheet simulation | 🥈 Release Candidate |
| **Statecraft** | [systems/statecraft/statecraft-game-loops.md](systems/statecraft/statecraft-game-loops.md) | Statecraft closed game loops: Directives, Volatility, National Issues, Consequences | 🥈 Release Candidate |
| **MyCountry** | [systems/mycountry.md](systems/mycountry.md) | Executive command suite (Command Surface v5, Statecraft Engine v4, Directives) | 🥈 Release Candidate |
| **MyCountry** | [systems/mycountry-design-philosophy-and-prds.md](systems/mycountry-design-philosophy-and-prds.md) | MyCountry design bible, 12 commandments, and statecraft loop PRDs | 🥈 Release Candidate |
| **WikiOS** | [systems/wikios/WIKIOS.md](systems/wikios/WIKIOS.md) | **WikiOS Master Spec** — MediaWiki headless independence, PlateJS editor, Parsoid pipeline | 🥈 Release Candidate |
| **WikiOS** | [systems/wikios/wikios-independence-2b-3.md](systems/wikios/wikios-independence-2b-3.md) | WikiOS Stage 2b (Postgres dual-write) & Stage 3 (render-service isolation) | 🥈 Release Candidate |
| **WikiOS** | [systems/wikios/wikios-stage3-config-plan.md](systems/wikios/wikios-stage3-config-plan.md) | WikiOS Stage 3 render-service configuration and deployment architecture | 🥈 Release Candidate |
| **WikiOS** | [systems/wikios/wikios-longevity-workflow.md](systems/wikios/wikios-longevity-workflow.md) | Multi-year WikiOS engine longevity and packaging workflow | 🥈 Release Candidate |
| **Builder** | [systems/builder.md](systems/builder.md) | Nation creation wizard (Builder v3), atomic components, wiki cache | 🥈 Release Candidate |
| **Economy** | [systems/economy.md](systems/economy.md) | Economic indicators, projections, tax system components, growth tiers | 🥈 Release Candidate |
| **Calculations**| [systems/calculations.md](systems/calculations.md) | Mathematical formulas for economic modeling, ERI, PII, and synergies | 🥈 Release Candidate |
| **Intelligence**| [systems/intelligence.md](systems/intelligence.md) | Intelligence feeds, vitality dashboard, threat forecasts, globalCache | 🥈 Release Candidate |
| **Diplomacy** | [systems/diplomacy.md](systems/diplomacy.md) | Embassies, missions, cultural exchanges, ThinkShare messaging, Concord v2 | 🥈 Release Candidate |
| **Defense** | [systems/defense.md](systems/defense.md) | Defense posture, readiness scoring, military operations, equipment catalogs | 🥈 Release Candidate |
| **Elections** | [systems/elections.md](systems/elections.md) | Elections, political parties, legislature, D'Hondt/FPTP simulation, hemicycle | 🥈 Release Candidate |
| **NPC AI** | [systems/npc-ai.md](systems/npc-ai.md) | NPC personality traits (8 traits), archetypes, behavioral prediction, drift | 🥈 Release Candidate |
| **Crises** | [systems/crisis-events.md](systems/crisis-events.md) | Dynamic crisis event management, 5-stage lifecycle, player response modes | 🥈 Release Candidate |
| **Social** | [systems/social.md](systems/social.md) | ThinkPages v2, ThinkShare unified messaging, activity feeds, polls | 🥈 Release Candidate |
| **ThinkTanks** | [systems/thinktanks.md](systems/thinktanks.md) | Collaborative groups & research engine, 4-pillar workspace, Apple design, Discord taxonomy | 🥈 Release Candidate |
| **Cards & Vault** | [systems/cards.md](systems/cards.md) · [systems/myvault.md](systems/myvault.md) | IxCards v2 & MyVault v2 UI — dynamic rarity, pack opening, crafting, store perks | 🥈 Release Candidate |
| **IxCredits** | [systems/ixcredits.md](systems/ixcredits.md) | Virtual currency ledger, atomic conditional balance locks, passive income | 🥈 Release Candidate |
| **NationStates**| [systems/ns-integration.md](systems/ns-integration.md) | NationStates card-dump sync, collection import, image proxy, takedown | 🥈 Release Candidate |
| **Achievements**| [systems/achievements.md](systems/achievements.md) | Achievement unlocks (Achievements v2), ribbon awards, LoreWards, leaderboards | 🥈 Release Candidate |
| **Admin CMS** | [systems/admin-cms.md](systems/admin-cms.md) | 50+ admin interfaces, dynamic CMS reference data, RBAC, audit logging | 📀 **Gold Master** |
| **Help Center** | [systems/help.md](systems/help.md) | In-app help center architecture, 10 categories, authoring workflow | 📀 **Gold Master** |
| **Forum** | [systems/forum.md](systems/forum.md) | XenForo forum integration (IxForum v1.3), BBCode transformation, IxnayID | 🥉 Beta |
| **Maps** | [systems/maps.md](systems/maps.md) | IxWorld 1.2 & Atlas Engine v4: UPG v2 100k mesh, MapLibre GL, Realms platform | 🥈 Release Candidate |
| **Map Editor** | [systems/map-editor-improvements-overview.md](systems/map-editor-improvements-overview.md) | Map editor architecture overview, performance and topology features | 🥈 Release Candidate |
| **Halo** | [systems/halo.md](systems/halo.md) | **Halo v4** plugin-driven contextual overlay and wayfinding suite | 📀 **Gold Master** |
| **MyLeague** | [systems/myleague.md](systems/myleague.md) · [systems/myleague-top5-features.md](systems/myleague-top5-features.md) | Sports simulation engine (7 sports, tactics, transfers, lore competitions) | 🥉 Beta |
| **Onoma** | [systems/onoma-brand-guide.md](systems/onoma-brand-guide.md) · [systems/onoma-glyph-spec.md](systems/onoma-glyph-spec.md) · [systems/onoma-voice-guide.md](systems/onoma-voice-guide.md) | Procedural linguistic engine, phonetic Markov chains, Kokoro TTS, glyphs | 🥈 Release Candidate |
| **IxTime** | [systems/ixtime.md](systems/ixtime.md) | **IxTime: Temporal Engine & Sync v2** — Continuous world simulation clock, speed dilation, bot sync, Statecraft temporal feeds | 📀 **Gold Master** |

---


## 📋 Formal Specifications & PRDs

| Document | Scope |
| --- | --- |
| [specs/vexel-prd.md](specs/vexel-prd.md) | **Vexel v1.0 PRD** — Heraldic symbol and coat-of-arms generator in IxLabs |
| [specs/myleague-v1-prd.md](specs/myleague-v1-prd.md) | **MyLeague v1.0 PRD** — Comprehensive sports league and simulation engine requirements |
| [specs/2026-08-13-ixcards-lore-first-rebuild.md](specs/2026-08-13-ixcards-lore-first-rebuild.md) | IxCards lore-first rebuilt specification |
| [specs/2026-08-10-achievements-ribbons-design.md](specs/2026-08-10-achievements-ribbons-design.md) | Achievements ribbon award design specification |

---

## 🛠️ Operations & Development Processes

| Document | Focus Area |
| --- | --- |
| [operations/local-dev-setup.md](operations/local-dev-setup.md) | Native Linux dev environment, DB syncing, Redis, and dev commands |
| [operations/deployment.md](operations/deployment.md) | Standalone build output, basePath wrapper, PM2 process management, and health checks |
| [operations/deployment-checklist.md](operations/deployment-checklist.md) | Pre-flight and post-deployment checklist |
| [operations/credentials.md](operations/credentials.md) | Credential and environment variables configuration |
| [operations/rate-limiting.md](operations/rate-limiting.md) | Redis-backed rate limiting configuration and endpoint protection |
| [operations/monitoring.md](operations/monitoring.md) | Logging, webhook alerts, disk space monitoring, and runtime health checks |
| [processes/testing.md](processes/testing.md) | Jest testing strategy, typecheck partition gates, and test fixtures |
| [processes/contributing.md](processes/contributing.md) | Code style, PR lifecycle, and branch conventions (`v2`) |
| [processes/refactoring.md](processes/refactoring.md) | Modular architecture patterns, file size ceilings (≤700L), and router-split recipe |
| [../scripts/README.md](../scripts/README.md) | **Active & Archived Scripts Catalog** — tooling, migration archives, and GIS calculators |
| [audits/src-monolith-candidates.md](audits/src-monolith-candidates.md) | Large file refactoring tracker (>800 lines) |

---

## 📚 Reference Documentation

| Document | Topic |
| --- | --- |
| [reference/api-complete.md](reference/api-complete.md) | Complete tRPC API catalog (90 routers, 1,450+ procedures) |
| [reference/database.md](reference/database.md) | Prisma models, relations, PostGIS extensions, and data ownership |
| [reference/revision.md](reference/revision.md) | **Versioning & Release Architecture** — platform/app/engine/system versions |
| [reference/branding.md](reference/branding.md) | Brand catalog — systems, icons, typography, and visual tokens |
| [reference/facet-design-system.md](reference/facet-design-system.md) | Facet design system tokens, depth hierarchy, materials, refraction |
| [reference/events.md](reference/events.md) | WebSocket channels, notification payloads, and scheduled cron jobs |
| [reference/edge-cases.md](reference/edge-cases.md) | Edge case handling, error boundaries, and recovery scenarios |
| [reference/oceanography-report.md](reference/oceanography-report.md) | Ocean basins, seas, currents, shipping routes, and marine ecology |
| [reference/premium-features.md](reference/premium-features.md) | Premium tiers, perk mappings, and feature access |
| [reference/synergies.md](reference/synergies.md) | Government and economic component synergy calculation tables |
| [reference/user-profile-utils.md](reference/user-profile-utils.md) | User display name, avatar, and profile resolution utilities |
| [reference/admin-endpoint-security-map.md](reference/admin-endpoint-security-map.md) | Admin endpoint security mappings & RBAC requirements |

---

## 🔬 Research & Player Feedback

| Document | Topic |
| --- | --- |
| [research/community-feedback-analysis.md](research/community-feedback-analysis.md) | Player feedback analysis (Urcea, Burg, Keaor, Heku) establishing the Statecraft Loop |
| [research/chatgpt-logs.md](research/chatgpt-logs.md) | Historical architectural synthesis and foundational game loops transcript |
| [research/community-logs.md](research/community-logs.md) | Community discussion logs and playtesting feedback |
| [research/sports-llm-commentary.md](research/sports-llm-commentary.md) | Research spike on LLM-generated sports commentary and match tickers |

---

## 🗄️ Historical Archive (`docs/archive/`)

Completed implementation plans, feature spike records, and legacy changelogs live in [`docs/archive/`](archive/):
- **Superpowers Brainstorming Archive**: [`docs/archive/superpowers/`](archive/superpowers/) (25 plans and 67 design specs from June–August 2026 feature sprints).
- **Design Spikes Archive**: [`docs/archive/design/`](archive/design/) (`province-generator.md`, `territory-brush.md`).
- **Legacy Changelog**: [`docs/archive/CHANGELOG_PRE_OGMA.md`](archive/CHANGELOG_PRE_OGMA.md) (v0.9 to v2.2.0).
- **Command Surface Migration Record**: [`docs/archive/mycountry-v2-command-surface-plan.md`](archive/mycountry-v2-command-surface-plan.md).
- **Pre-UPG v2 Maps Spec**: [`docs/archive/maps-1.1.md`](archive/maps-1.1.md).
