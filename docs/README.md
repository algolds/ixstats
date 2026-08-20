# IxStates (IxStats) Documentation Hub

The single index for all IxStates documentation. Guides are grouped by purpose so
engineers, storytellers, and operators land in the right place. Version info comes from
the [Version Registry](../src/lib/buildVersion.ts) — see [Versioning & Release Architecture](reference/revision.md).

> Last refreshed August 2026 — **IxStates 1.3.0 "Ogma"** (Beta). Treat this structure as the source of truth.  
> Working plans/PRDs/audits live in the gitignored root `plans/`; completed/historical docs live in [`archive/`](archive/).

## Quick Links

- **System Status & Going Gold Audit** — [systems/SYSTEM_STATUS.md](systems/SYSTEM_STATUS.md)
- **Product overview** — [overview/platform.md](overview/platform.md)
- **Versioning & releases** — [reference/revision.md](reference/revision.md)
- **API catalog** — [reference/api-complete.md](reference/api-complete.md)
- **Database models** — [reference/database.md](reference/database.md)
- **Local dev setup** — [operations/local-dev-setup.md](operations/local-dev-setup.md)
- **Deployment** — [operations/deployment.md](operations/deployment.md)
- **Design system (Facet)** — [reference/facet-design-system.md](reference/facet-design-system.md)
- **Maps system** — [systems/maps.md](systems/maps.md)
- **WikiOS platform** — [systems/wikios.md](systems/wikios.md)

## Overview

| Document | Summary |
| --- | --- |
| [overview/platform.md](overview/platform.md) | Product charter, personas, pillars, release positioning |

## Architecture

| Document | Summary |
| --- | --- |
| [architecture/frontend.md](architecture/frontend.md) | App Router layout, component layers, design-system guidelines |
| [architecture/backend.md](architecture/backend.md) | tRPC patterns, middleware, rate limiting, auth context |
| [architecture/data.md](architecture/data.md) | Prisma schema domains, migrations, seeders, data lifecycle |
| [prevent_ts_graph_explosion.md](prevent_ts_graph_explosion.md) | TypeScript graph isolation (modular tsconfigs, cross-router import ban). Resolved in 1.0.6; enforced by `scripts/audit/audit-arch.ts` |
| [AUTOSAVE_ARCHITECTURE.md](AUTOSAVE_ARCHITECTURE.md) | Autosave system architecture (map editor) |
| [FRAMEWORK_SPEC.md](FRAMEWORK_SPEC.md) | IxWorld & Realms multi-tenant framework specification, creation studio, and data models |

> Root-level [`arch.md`](../arch.md) is the agent-facing condensed version of the TS-graph architecture rules (referenced by `CLAUDE.md`).

## Systems & Launch Status

| Document | Summary | Launch Status |
| --- | --- | :---: |
| [systems/SYSTEM_STATUS.md](systems/SYSTEM_STATUS.md) | **Master System Status & Public Launch Readiness Audit ("Going Gold")** | 📀 **Target: 1.0.0 GM** |
| [systems/mycountry.md](systems/mycountry.md) | Executive command suite (Command Surface v5, Statecraft Engine v4, Directives) | 🥈 Release Candidate |
| [systems/mycountry-design-philosophy-and-prds.md](systems/mycountry-design-philosophy-and-prds.md) | MyCountry design bible, 12 commandments, and statecraft loop PRDs | 🥈 Release Candidate |
| [systems/mycountry-v2-command-surface-plan.md](systems/mycountry-v2-command-surface-plan.md) | Command Surface transition record and single production surface reference | ✅ Completed |
| [systems/community-feedback-audit.md](systems/community-feedback-audit.md) | Co-design audit (Urcea, Keaor, Burg, Heku) establishing the Statecraft Loop | 🥈 Release Candidate |
| [systems/builder.md](systems/builder.md) | Nation creation wizard (Builder v3), atomic components, wiki cache | 🥈 Release Candidate |
| [systems/economy.md](systems/economy.md) | Economic indicators, projections, tax system components, growth tiers | 🥈 Release Candidate |
| [systems/calculations.md](systems/calculations.md) | Mathematical formulas for economic modeling, ERI, PII, and synergies | 🥈 Release Candidate |
| [systems/intelligence.md](systems/intelligence.md) | Intelligence feeds, vitality dashboard, threat forecasts, globalCache | 🥈 Release Candidate |
| [systems/diplomacy.md](systems/diplomacy.md) | Embassies, missions, cultural exchanges, ThinkShare messaging, Concord v2 | 🥈 Release Candidate |
| [systems/defense.md](systems/defense.md) | Defense posture, readiness scoring, military operations, equipment catalogs | 🥈 Release Candidate |
| [systems/elections.md](systems/elections.md) | Elections, political parties, legislature, D'Hondt/FPTP simulation, hemicycle | 🥈 Release Candidate |
| [systems/npc-ai.md](systems/npc-ai.md) | NPC personality traits (8 traits), archetypes, behavioral prediction, drift | 🥈 Release Candidate |
| [systems/crisis-events.md](systems/crisis-events.md) | Dynamic crisis event management, 5-stage lifecycle, player response modes | 🥈 Release Candidate |
| [systems/social.md](systems/social.md) | ThinkPages v2, ThinkShare unified messaging, activity feeds, polls | 🥈 Release Candidate |
| [systems/wikios.md](systems/wikios.md) | **WikiOS v1 Knowledge Platform** (PlateJS editor, Canvas v1, Parsoid, Narrator) | 🥈 Release Candidate |
| [systems/achievements.md](systems/achievements.md) | Achievement unlocks (Achievements v2), ribbon awards, LoreWards, leaderboards | 🥈 Release Candidate |
| [systems/admin-cms.md](systems/admin-cms.md) | 50+ admin interfaces, dynamic CMS reference data, RBAC, audit logging | 📀 **Gold Master** |
| [systems/help.md](systems/help.md) | In-app help center architecture, 10 categories, authoring workflow | 📀 **Gold Master** |
| [systems/forum.md](systems/forum.md) | XenForo forum integration (IxForum v1.3), BBCode transformation, IxnayID | 🥉 Beta |
| [systems/maps.md](systems/maps.md) | IxWorld 1.2 & Atlas Engine v4: UPG v2 100k mesh, MapLibre GL, Realms platform | 🥈 Release Candidate |
| [systems/dynamic-island.md](systems/dynamic-island.md) | **Halo v4** plugin-driven contextual overlay and wayfinding suite | 📀 **Gold Master** |
| [systems/myleague.md](systems/myleague.md) | MyLeague & MyClub sports simulation engine (7 sports, tactics, transfers) | 🥉 Beta |
| [systems/myleague-lore-integration.md](systems/myleague-lore-integration.md) | MyLeague sports lore audit, canonical competition mapping, and gap analysis | 🥉 Beta |
| [systems/onoma-brand-guide.md](systems/onoma-brand-guide.md) | Onoma v4 brand guide, linguistic engine philosophy, Pattern Depth abstraction | 🥈 Release Candidate |
| [systems/onoma-glyph-spec.md](systems/onoma-glyph-spec.md) | Onoma v4 glyph system specification, 6 semantic domains, `<OnomaGlyph />` | 🥈 Release Candidate |
| [systems/onoma-voice-guide.md](systems/onoma-voice-guide.md) | Onoma Voice (Kokoro TTS double-engine) developer integration & testing guide | 🥈 Release Candidate |

### IxVault

| Document | Summary | Launch Status |
| --- | --- | :---: |
| [systems/cards.md](systems/cards.md) | IxCards v2 — card types, dynamic rarity, pack opening, crafting, junking | 🥈 Release Candidate |
| [systems/myvault.md](systems/myvault.md) | MyVault v2 UI & economy hub, VaultRouter, level progression, config | 🥈 Release Candidate |
| [systems/ixcredits.md](systems/ixcredits.md) | IxCredits virtual currency engine, passive dividends, daily caps, sinks | 🥈 Release Candidate |
| [systems/ns-integration.md](systems/ns-integration.md) | NationStates card-dump sync, collection import, image proxy, takedown | 🥈 Release Candidate |
| [PREMIUM_FEATURES.md](PREMIUM_FEATURES.md) | Premium features matrix | 🥈 Release Candidate |

## Operations

| Document | Summary |
| --- | --- |
| [operations/local-dev-setup.md](operations/local-dev-setup.md) | WSL2 local dev setup, DB syncing, automation workflow |
| [operations/deployment.md](operations/deployment.md) | Build pipeline, base paths, server scripts, rollback |
| [operations/monitoring.md](operations/monitoring.md) | Logging, webhook alerts, runtime health checks |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Production deployment checklist |
| [CREDENTIALS.md](CREDENTIALS.md) | Credential & secrets management |
| [RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md) | Rate limiting config, Redis setup, endpoint protection |

## Processes

| Document | Summary |
| --- | --- |
| [processes/testing.md](processes/testing.md) | Jest strategy, wiring audits, fixtures, automation |
| [processes/contributing.md](processes/contributing.md) | Coding standards, review protocol, release cadence |
| [processes/refactoring.md](processes/refactoring.md) | Modular architecture patterns, router-split recipe |

## Reference

| Document | Summary |
| --- | --- |
| [reference/api-complete.md](reference/api-complete.md) | Complete tRPC API catalog (90 routers, 1,450+ procedures) |
| [reference/database.md](reference/database.md) | Prisma models, relations, derived views, data ownership |
| [reference/revision.md](reference/revision.md) | **Versioning & Release Architecture** — platform/app/engine/system versions, Version Registry |
| [reference/branding.md](reference/branding.md) | Brand catalog — systems, icons, colors, visual tokens |
| [reference/facet-design-system.md](reference/facet-design-system.md) | Facet design system tokens, depth, materials, refraction |
| [reference/events.md](reference/events.md) | WebSocket channels, notification payloads, scheduled jobs |
| [reference/edge-cases.md](reference/edge-cases.md) | Edge case handling and error scenarios |
| [SYNERGY_REFERENCE.md](SYNERGY_REFERENCE.md) | Government component synergy system and interactions |
| [ADMIN_ENDPOINT_SECURITY_MAP.md](ADMIN_ENDPOINT_SECURITY_MAP.md) | Admin endpoint security mappings & auth requirements |
| [USER_PROFILE_UTILS_USAGE.md](USER_PROFILE_UTILS_USAGE.md) | User profile utilities & display-name implementation |
| [EXTERNAL_API_CACHE.md](EXTERNAL_API_CACHE.md) | External API caching strategy |
| [CACHE_INTEGRATION_EXAMPLE.md](CACHE_INTEGRATION_EXAMPLE.md) | Cache integration code examples |

## Maps & World

| Document | Summary |
| --- | --- |
| [systems/maps.md](systems/maps.md) | IxWorld map system (primary maps guide) |
| [IXWORLD_OCEANOGRAPHY_REPORT.md](IXWORLD_OCEANOGRAPHY_REPORT.md) | Ocean basins, seas, currents, shipping routes, marine ecology |
| [maps-1.1.md](maps-1.1.md) | Maps 1.1 core editing engine spec |
| [design/territory-brush.md](design/territory-brush.md) | Territory brush design doc |
| [design/province-generator.md](design/province-generator.md) | Province generator design doc |
| [superpowers/specs/2026-06-15-unified-world-editor-design.md](superpowers/specs/2026-06-15-unified-world-editor-design.md) | Unified world editor design spec |

## Voice & Speech (Onoma)

| Document | Summary |
| --- | --- |
| [systems/onoma-voice-guide.md](systems/onoma-voice-guide.md) | Onoma Voice (Kokoro) developer integration & testing guide |
| [superpowers/plans/2026-06-27-wikios-voice-narrator-plan.md](superpowers/plans/2026-06-27-wikios-voice-narrator-plan.md) | Implementation plan for WikiOS Article Narrator |

## Audits & Research

| Document | Summary |
| --- | --- |
| [audits/AUDIT_2026-06.md](audits/AUDIT_2026-06.md) | V1 compliance audit (production-readiness review) |
| [audits/AUDIT_2026-06-13.md](audits/AUDIT_2026-06-13.md) | Router refactor audit (patch 1.0.6) |
| [audits/REFACTOR_PLAN_2026-06.md](audits/REFACTOR_PLAN_2026-06.md) | Plan behind the V1 compliance work |
| [research/sports-llm-commentary.md](research/sports-llm-commentary.md) | Research spike: sports LLM commentary |
| [MyLeague_v1_PRD.md](MyLeague_v1_PRD.md) | MyLeague v1 product requirements |

## Archive

Completed implementation reports, historical audits, and retired guides live in
[`archive/`](archive/) — kept for context, not maintained:

- [`archive/v1/`](archive/v1/) — v1.0 historical docs and technical guides (80+ files)
- [`archive/pre-consolidation/`](archive/pre-consolidation/) — pre-October-2025 state (incl. tax-system docs)
- [`archive/`](archive/) — v1.1.x completion reports, security audits, performance benchmarks

## Maintenance

1. Update the relevant table here when adding, renaming, or archiving a doc.
2. Update Markdown alongside code — feature-directory READMEs and the relevant system guide.
3. Keep `/help` in sync with the system guides so in-app and repo guidance match.
4. Retire docs to `archive/` instead of deleting them when a feature is removed.
5. Keep the project root clean — only README, CHANGELOG, CLAUDE, AGENTS, arch.md, maps.md.
