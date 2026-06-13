# IxStates (IxStats) Documentation Hub

> **🆕 NEW (November 2025):** The messaging system has been unified! All messaging—personal, diplomatic, and official—now uses **ThinkShare** as the single backbone. See [systems/UNIFIED_MESSAGING_SYSTEM.md](./systems/UNIFIED_MESSAGING_SYSTEM.md) for complete details.

This repository refresh introduces a streamlined documentation set that mirrors the current codebase. The guides are grouped by purpose so engineers, storytellers, and operators can quickly land in the right place.

- **Overview** – product positioning, feature map, quick facts
- **Architecture** – frontend, backend, and data internals
- **Systems** – deep dives for each major gameplay or management module
- **Operations** – environment management, deployments, monitoring
- **Processes** – testing, contributing, incident workflows
- **Reference** – API, database, and event schemas

Legacy documents have been relocated to `docs/archive/v1`. Keep them for historical context, but use the refreshed material below for all future work.

## Navigation

### Overview
- [`overview/platform.md`](overview/platform.md) – project charter, personas, and release cadence
- [`overview/feature-map.md`](overview/feature-map.md) – map of routes, components, hooks, and supporting services

### Architecture
- [`architecture/frontend.md`](architecture/frontend.md) – App Router layout, component layers, design system guidelines
- [`architecture/backend.md`](architecture/backend.md) – tRPC patterns, middleware, rate limiting, and user context
- [`architecture/data.md`](architecture/data.md) – Prisma schema overview, migrations, seeders, and data lifecycle

### Systems
- [`systems/mycountry.md`](systems/mycountry.md) – executive command suite, compliance tooling, and analytics
- [`systems/social.md`](systems/social.md) – ThinkPages, ThinkShare, and collaborative research experiences
- [`systems/achievements.md`](systems/achievements.md) – achievement unlock logic, leaderboards, and notifications
- [`systems/builder.md`](systems/builder.md) – nation creation flows, atomic components, and data ingestion
- [`systems/help.md`](systems/help.md) – in-app help center architecture and authoring workflow
- [`systems/admin-cms.md`](systems/admin-cms.md) – 28+ admin interfaces, CMS architecture, and role-based access
- [`systems/calculations.md`](systems/calculations.md) – economic formulas with step-by-step examples
- [`systems/npc-ai.md`](systems/npc-ai.md) – NPC personality system documentation
- [`systems/crisis-events.md`](systems/crisis-events.md) – crisis management system guide
- #### IxVault (Integrated Product)
- [`systems/cards.md`](systems/cards.md) – IxCards system, card types, ownership
- [`systems/card-packs.md`](systems/card-packs.md) – card pack types, rarity, opening flow
- [`systems/myvault.md`](systems/myvault.md) – MyVault economy, IxCredits
- [`systems/ns-integration.md`](systems/ns-integration.md) – NationStates integration
- [`systems/ixcredits.md`](systems/ixcredits.md) – IxCredits economy and premium features
- #### MyCountry Subsystems (Core System)
- [`systems/intelligence.md`](systems/intelligence.md) – live briefing feeds, diplomatic intelligence, and forecasting
- [`systems/diplomacy.md`](systems/diplomacy.md) – embassies, missions, cultural exchanges, and relationship scoring
- [`systems/economy.md`](systems/economy.md) – economic indicators, builder integration, and modeling utilities
- [`systems/defense.md`](systems/defense.md) – defense posture, SDI modules, readiness tracking, and crisis playbooks
- [`systems/elections.md`](systems/elections.md) – Elections, political parties, and legislature management
- [`systems/national-issues.md`](systems/national-issues.md) – National issues engine and consequences
- [`systems/forum.md`](systems/forum.md) – XenForo forum integration and widget embedding
- [`systems/maps.md`](systems/maps.md) – IxWorld interactive map, MapLibre GL JS, procedural world generation, border editor
- [`systems/dynamic-island.md`](systems/dynamic-island.md) – **Halo** (formerly Dynamic Island) plugin-driven system architecture, registry, and custom layouts (Core System)

### Operations
- [`operations/local-dev-setup.md`](operations/local-dev-setup.md) – comprehensive WSL2 local development environment setup, database syncing, and automation workflow
- [`operations/environments.md`](operations/environments.md) – environment tiers, required variables, and secrets
- [`operations/deployment.md`](operations/deployment.md) – build pipeline, base paths, server scripts, and rollback tools
- [`operations/monitoring.md`](operations/monitoring.md) – logging, webhook alerts, and runtime health checks

### Processes
- [`processes/testing.md`](processes/testing.md) – Jest strategy, wiring audits, browser automation, and fixtures
- [`processes/contributing.md`](processes/contributing.md) – coding standards, review expectations, and release management
- [`processes/refactoring.md`](processes/refactoring.md) – modular architecture patterns and refactoring guidelines
- [`processes/schema-validation.md`](processes/schema-validation.md) – schema validation and alignment procedures

- [`reference/api-complete.md`](reference/api-complete.md) – complete tRPC API catalog (1,329 endpoints across 83 routers)
- [`reference/api.md`](reference/api.md) – generated tRPC router & procedure index with request/response patterns
- [`reference/api-examples.md`](reference/api-examples.md) – tRPC API usage examples
- [`reference/database.md`](reference/database.md) – Prisma model catalogue and relational diagrams
- [`reference/branding.md`](reference/branding.md) – complete brand catalog: all systems, icons, colors, and visual identity tokens
- [`./reference/revision.md`](./reference/revision.md) – **Versioning & Release Architecture**: platform (`Major.Minor.Patch` + epoch release name + channel), Apps/Engines/Systems single-integer versions, the Version Registry (`src/lib/buildVersion.ts`), schema/API/build versioning
- [`reference/events.md`](reference/events.md) – websocket channels, notification payloads, and scheduled jobs
- [`reference/edge-cases.md`](reference/edge-cases.md) – edge case handling and error scenarios
- [`SYNERGY_REFERENCE.md`](SYNERGY_REFERENCE.md) – government component synergy system and interaction patterns
- [`RATE_LIMITING_IMPLEMENTATION_GUIDE.md`](RATE_LIMITING_IMPLEMENTATION_GUIDE.md) – rate limiting implementation and configuration guide
- [`RATE_LIMITING_GUIDE.md`](RATE_LIMITING_GUIDE.md) – comprehensive rate limiting configuration and Redis setup
- [`ADMIN_ENDPOINT_SECURITY_MAP.md`](ADMIN_ENDPOINT_SECURITY_MAP.md) – admin endpoint security mappings and authentication requirements
- [`USER_PROFILE_UTILS_USAGE.md`](USER_PROFILE_UTILS_USAGE.md) – user profile utilities and display name implementation
- [`operations/local-dev-setup.md`](operations/local-dev-setup.md) – comprehensive WSL2 local dev environment setup guide
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) – comprehensive API documentation and usage patterns

### Tax System Reference
- [`archive/pre-consolidation/TAX_SYSTEM_PERSISTENCE.md`](archive/pre-consolidation/TAX_SYSTEM_PERSISTENCE.md) – tax system persistence architecture and implementation
- [`archive/pre-consolidation/TAX_SYSTEM_DATA_STRUCTURE.md`](archive/pre-consolidation/TAX_SYSTEM_DATA_STRUCTURE.md) – tax system data structures and type definitions
- [`archive/pre-consolidation/TAX_SYSTEM_FRONTEND_EXAMPLE.md`](archive/pre-consolidation/TAX_SYSTEM_FRONTEND_EXAMPLE.md) – tax system frontend integration examples
- [`archive/pre-consolidation/TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md`](archive/pre-consolidation/TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md) – complete tax system implementation summary
- [`TAX_SYSTEM.md`](TAX_SYSTEM.md) – tax system overview

### Maps & World Visualization
- [`systems/maps.md`](systems/maps.md) – IxWorld map system: MapLibre GL JS, 7 layers, geo API (102 endpoints across 6 router files), border editor
- [`IXWORLD_OCEANOGRAPHY_REPORT.md`](IXWORLD_OCEANOGRAPHY_REPORT.md) – ocean basins, seas, currents, shipping routes, and marine ecology

### Operations & Deployment Reference
- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) – production deployment checklist
- [`PRE_DEPLOYMENT_CHECKLIST.md`](PRE_DEPLOYMENT_CHECKLIST.md) – pre-deployment verification steps
- [`TROUBLESHOOTING_v1.2.md`](TROUBLESHOOTING_v1.2.md) – troubleshooting guide for v1.2
- [`CREDENTIALS.md`](CREDENTIALS.md) – credentials and secrets management
- [`PERFORMANCE_BENCHMARKS.md`](PERFORMANCE_BENCHMARKS.md) – performance metrics and benchmarks
- [`EXTERNAL_API_CACHE.md`](EXTERNAL_API_CACHE.md) – external API caching strategies
- [`CACHE_INTEGRATION_EXAMPLE.md`](CACHE_INTEGRATION_EXAMPLE.md) – cache integration implementation examples

### Development Reference
- [`development/ixcards-phase1.md`](development/ixcards-phase1.md) – IxCards phase 1 implementation guide
- [`guides/DIPLOMATIC_MESSAGING_MIGRATION.md`](guides/DIPLOMATIC_MESSAGING_MIGRATION.md) – diplomatic messaging migration guide

## Archive

Completed implementation docs, audit reports, and historical documentation are preserved in:
- [`archive/`](archive/) – v1.1.3 completed implementation and security audits (17 documents)
  - Implementation completion reports (PHASE_1_2, TAX_SYSTEM, NATIONAL_IDENTITY, ATOMIC_COMPONENTS)
  - Security audits (SECURITY_AUDIT_2025-10-22, SECURITY_AUDIT_TASK_1.4_1.7_COMPLETED)
  - Status reports (ACHIEVEMENT_SUMMARY, IMPLEMENTATION_EXECUTIVE_SUMMARY, IMPLEMENTATION_STATUS_v1.2)
  - Code audits (AUDIT_REPORT_2025-10-19, AUDIT_REPORT_V1.1, CODEBASE_AUDIT_OCTOBER_2025, CHANGELOG_V1.1)
  - Border editing implementation (BORDER_EDITING_CHECKLIST, BORDER_EDITING_IMPLEMENTATION_SUMMARY)
- [`archive/v1/`](archive/v1/) – v1.0 historical documentation and technical guides (80+ documents)
- [`archive/pre-consolidation/`](archive/pre-consolidation/) – documentation state before October 2025 consolidation

## How to Maintain This Documentation
1. Update Markdown alongside code changes—especially READMEs in feature directories and the relevant system guide.
2. Run or extend automation in `scripts/audit` when adding routers, models, or calculations; capture outputs in the reference docs.
3. Keep `/help` synchronized with the Markdown guides so users receive the same guidance in-app and in the repository.
4. Move outdated docs to `docs/archive/<date>` instead of deleting them when retiring features.
5. Keep root directory clean—only active documents (README, CLAUDE, CHANGELOG, IMPLEMENTATION_PLAN, IMPLEMENTATION_STATUS).

The documentation was last refreshed June 2026 (**IxStates 1.0 "Ogma"**). Treat the structure as the source of truth going forward. Version info comes from the [Version Registry](../src/lib/buildVersion.ts); see the [Versioning & Release Architecture](./reference/revision.md).
