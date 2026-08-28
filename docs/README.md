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
- **Facet Design System & Interaction Bible (v2)** — [reference/facet-design-system.md](reference/facet-design-system.md)
- **Frontend & UI Cheatsheet (Junior Dev Guide)** — [reference/ui-cheatsheet.md](reference/ui-cheatsheet.md)
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

## ⚙️ Systems & Platform Pillars (App-Centric Organization)

### 🏛️ 1. MyCountry Suite (Executive Simulation & Governance)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Command Suite** | [systems/mycountry.md](systems/mycountry.md) | Single-surface executive console across active public domains (Identity, Economy, Politics, Diplomacy) | 📀 **Gold Master** |
| **Statecraft Engine** | [systems/statecraft/mycountry-vision-audit.md](systems/statecraft/mycountry-vision-audit.md) | Statecraft Philosophy — Executive decision simulator vs spreadsheet simulation | 📀 **Gold Master** |
| **Game Loops** | [systems/statecraft/statecraft-game-loops.md](systems/statecraft/statecraft-game-loops.md) | Closed decision loops: Directives, Volatility, National Issues, Consequences | 📀 **Gold Master** |
| **Design Philosophy**| [systems/mycountry-design-philosophy-and-prds.md](systems/mycountry-design-philosophy-and-prds.md) | MyCountry design bible, 12 commandments, and statecraft loop PRDs | 📀 **Gold Master** |
| **Country Builder** | [systems/builder.md](systems/builder.md) | Sovereign onboarding wizard (Builder v3), atomic component matrix, wiki caching | 📀 **Gold Master** |
| **Economy Domain** | [systems/economy.md](systems/economy.md) · [systems/calculations.md](systems/calculations.md) | Macroeconomic indicators, 42-tax system, ERI/PII index formulas, growth tiers | 📀 **Gold Master** |
| **Diplomacy Domain** | [systems/diplomacy.md](systems/diplomacy.md) | Embassies, bilateral missions, cultural exchanges, treaty dashboards | 📀 **Gold Master** |
| **Politics & Elections**| [systems/elections.md](systems/elections.md) | Legislature config, political parties, D'Hondt/FPTP simulation, hemicycle | 📀 **Gold Master** |
| *Defense (Preview)* | [systems/defense.md](systems/defense.md) | Force readiness, military deployments, equipment procurement (preview) | 🧪 **Preview** |
| *Intel (Preview)* | [systems/intelligence.md](systems/intelligence.md) | Executive threat briefings, vitality dashboard, recon research ops (preview) | 🧪 **Preview** |

### 🗺️ 2. Atlas (Spatial Geography & Cartography Studio)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Atlas Maps** | [systems/maps.md](systems/maps.md) | Atlas v2 & Atlas Engine v5: "Geography is King", grounded manual IxEarth cartography + UPG v2 | 📀 **Gold Master** |
| **Map Editor** | [systems/maps.md](systems/maps.md) · [systems/map-editor-improvements-overview.md](systems/map-editor-improvements-overview.md) | Full-screen vector editor for borders, regions, provinces, cities, POIs, and Voronoi snapping | 📀 **Gold Master** |

### 📖 3. WikiOS (Lore & Knowledge Operating System)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Native Lore Engine**| [systems/wikios.md](systems/wikios.md) · [systems/wikios/WIKIOS.md](systems/wikios/WIKIOS.md) | Native PostgreSQL lore engine, sub-2ms O(1) link graph, Canvas Editor (v1) | 📀 **Gold Master** |
| **Margin** | [systems/wikios/wikios-margin-spec.md](systems/wikios/wikios-margin-spec.md) | Split-canvas inspector, text markup, gutter pins, threaded notes directly on text | 📀 **Gold Master** |
| **Stash System** | [systems/stash.md](systems/stash.md) · [systems/stash-style-guide.md](systems/stash-style-guide.md) | Save articles, quotes, media, and forum threads for later | 📀 **Gold Master** |
| **Lore Lifecycle** | [systems/lore-lifecycle.md](systems/lore-lifecycle.md) | Complete lore lifecycle from ThinkTanks/Stashes to Canvas Publishing and Wiki Awards | 📀 **Gold Master** |

### 💎 4. Vault (Metagame Incentives, Social Economy & Collectibles)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Metagame Incentive Hub**| [systems/myvault.md](systems/myvault.md) | Central incentive and metagame engine, dividend payouts, social currency | 📀 **Gold Master** |
| **Cards System** | [systems/cards.md](systems/cards.md) | 3D holographic cards across 5 editions, physics pack peeling, dynamic rarity | 📀 **Gold Master** |
| **IxCredits Ledger** | [systems/ixcredits.md](systems/ixcredits.md) | Virtual currency ledger, atomic conditional balance locks, daily UTC streaks | 📀 **Gold Master** |
| **Achievements** | [systems/achievements.md](systems/achievements.md) | Achievement unlocks (Achievements v2), ribbon racks, leaderboard progression | 📀 **Gold Master** |
| **NationStates Bridge**| [systems/ns-integration.md](systems/ns-integration.md) | NationStates card-dump sync, collection import, image proxy, takedown verification | 📀 **Gold Master** |

### 💬 5. ThinkPages (Real-Time Knowledge Feed & Communications)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Sovereign Feed** | [systems/social.md](systems/social.md) | Sovereign micro-posts, `[blurb:slug]` tag embedding, poll items, rich wiki cards | 📀 **Gold Master** |
| **Account Manager** | [systems/social.md](systems/social.md) | Multi-account switching, automated Discord webhook syndication, bot telemetry | 📀 **Gold Master** |
| **ThinkTanks** | [systems/thinktanks.md](systems/thinktanks.md) | Multilateral policy drafting rooms, research workgroups, shared drafts | 📀 **Gold Master** |

### 🗨️ 6. IxForum App (Archival Community Discourse)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Forum Integration** | [systems/forum.md](systems/forum.md) | XenForo REST bridge (IxForum v1.4), Orange theme, BBCode transformation, IxnayID SSO | 📀 **Gold Master** |

### ⚙️ 7. Concord Engine (Living-World Simulation Backend)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **IxTime Master Clock**| [systems/ixtime.md](systems/ixtime.md) | Continuous temporal simulation engine, epoch conversion, daemon synchronization | 📀 **Gold Master** |
| **Crisis Events** | [systems/crisis-events.md](systems/crisis-events.md) | Dynamic crisis event management, 5-stage lifecycle, player response modes | 📀 **Gold Master** |
| **NPC Personality AI**| [systems/npc-ai.md](systems/npc-ai.md) | NPC personality traits (8 traits), archetypes, behavioral prediction, drift | 📀 **Gold Master** |

### 🎨 8. Facet UI Design System & Ambient Runtime
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Facet Primitives** | [reference/facet-design-system.md](reference/facet-design-system.md) | Volumetric Z-depth, physical materials, glare, 100% Radix UI encapsulation | 📀 **Gold Master** |
| **Halo Overlay** | [systems/halo.md](systems/halo.md) | Facet contextual overlay, wayfinding suite, and `Cmd+K` command palette | 📀 **Gold Master** |
| **Admin CMS** | [systems/admin-cms.md](systems/admin-cms.md) | 50+ admin interfaces, dynamic reference catalogs, RBAC, audit logging | 📀 **Gold Master** |
| **Help Center** | [systems/help.md](systems/help.md) | In-app help center architecture, 10 categories, authoring workflow | 📀 **Gold Master** |

### 🧪 Labs (Experimental & Incubation Studio)
| System / Tool | Document | Scope & Architecture | Status |
| :--- | :--- | :--- | :---: |
| **Onoma Studio** | [systems/onoma-brand-guide.md](systems/onoma-brand-guide.md) · [systems/onoma-roadmap.md](systems/onoma-roadmap.md) | Procedural linguistic engine, phonetic Markov chains, Kokoro TTS, glyphs | 🧪 **Labs Preview** |
| **MyLeague & MyClub** | [systems/myleague.md](systems/myleague.md) · [systems/myleague-top5-features.md](systems/myleague-top5-features.md) | Sports simulation engine (7 sports, tactics, transfers, athlete cards) | 🧪 **Labs Preview** |

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
| [audits/test-suite-audit-and-justification.md](audits/test-suite-audit-and-justification.md) | **Test Suite Audit & Justification** — 122-file inventory, value stack ranking (Tiers 0–4), and ponytail prune candidates |


---

## 📚 Reference Documentation

| Document | Topic |
| --- | --- |
| [reference/api-complete.md](reference/api-complete.md) | Complete tRPC API catalog (90 routers, 1,450+ procedures) |
| [reference/database.md](reference/database.md) | Prisma models, relations, PostGIS extensions, and data ownership |
| [reference/revision.md](reference/revision.md) | **Versioning & Release Architecture** — platform/app/engine/system versions |
| [reference/branding.md](reference/branding.md) | Brand catalog — systems, icons, typography, and visual tokens |
| [reference/facet-design-system.md](reference/facet-design-system.md) | **Facet Design System & Interaction Bible (v2)** — materials, Z-depth scale, 100% Radix primitives, Cuelume audio matrix, and Apple/Emil motion physics |
| [reference/ui-cheatsheet.md](reference/ui-cheatsheet.md) | **Frontend & UI Cheatsheet (Junior Dev Guide)** — component recipes, code snippets, zero-hex tokens, and anti-pitfall guide |
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
