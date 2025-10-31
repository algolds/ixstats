# IxStats Documentation Hub

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
- [`systems/intelligence.md`](systems/intelligence.md) – live briefing feeds, diplomatic intelligence, and forecasting
- [`systems/diplomacy.md`](systems/diplomacy.md) – embassies, missions, cultural exchanges, and relationship scoring
- [`systems/economy.md`](systems/economy.md) – economic indicators, builder integration, and modeling utilities
- [`systems/defense.md`](systems/defense.md) – defense posture, SDI modules, readiness tracking, and crisis playbooks
- [`systems/social.md`](systems/social.md) – ThinkPages, ThinkShare, and collaborative research experiences
- [`systems/achievements.md`](systems/achievements.md) – achievement unlock logic, leaderboards, and notifications
- [`systems/builder.md`](systems/builder.md) – nation creation flows, atomic components, and data ingestion
- [`systems/help.md`](systems/help.md) – in-app help center architecture and authoring workflow

### Operations
- [`operations/environments.md`](operations/environments.md) – environment tiers, required variables, and secrets
- [`operations/deployment.md`](operations/deployment.md) – build pipeline, base paths, server scripts, and rollback tools
- [`operations/monitoring.md`](operations/monitoring.md) – logging, webhook alerts, and runtime health checks

### Processes
- [`processes/testing.md`](processes/testing.md) – Jest strategy, wiring audits, browser automation, and fixtures
- [`processes/contributing.md`](processes/contributing.md) – coding standards, review expectations, and release management

### Reference
- [`reference/api.md`](reference/api.md) – generated tRPC router & procedure index with request/response patterns
- [`reference/database.md`](reference/database.md) – Prisma model catalogue and relational diagrams
- [`reference/events.md`](reference/events.md) – websocket channels, notification payloads, and scheduled jobs
- [`SYNERGY_REFERENCE.md`](SYNERGY_REFERENCE.md) – government component synergy system and interaction patterns
- [`RATE_LIMITING_IMPLEMENTATION_GUIDE.md`](RATE_LIMITING_IMPLEMENTATION_GUIDE.md) – rate limiting implementation and configuration guide
- [`RATE_LIMITING_GUIDE.md`](RATE_LIMITING_GUIDE.md) – comprehensive rate limiting configuration and Redis setup
- [`ADMIN_ENDPOINT_SECURITY_MAP.md`](ADMIN_ENDPOINT_SECURITY_MAP.md) – admin endpoint security mappings and authentication requirements
- [`USER_PROFILE_UTILS_USAGE.md`](USER_PROFILE_UTILS_USAGE.md) – user profile utilities and display name implementation
- [`DEV_DATABASE_SETUP.md`](DEV_DATABASE_SETUP.md) – development database setup and management guide
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) – comprehensive API documentation and usage patterns

### Tax System Reference
- [`TAX_SYSTEM_PERSISTENCE.md`](TAX_SYSTEM_PERSISTENCE.md) – tax system persistence architecture and implementation
- [`TAX_SYSTEM_DATA_STRUCTURE.md`](TAX_SYSTEM_DATA_STRUCTURE.md) – tax system data structures and type definitions
- [`TAX_SYSTEM_FRONTEND_EXAMPLE.md`](TAX_SYSTEM_FRONTEND_EXAMPLE.md) – tax system frontend integration examples
- [`TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md`](TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md) – complete tax system implementation summary

### Map Editor & Vector Tiles Reference
- [`VECTOR_TILES_COMPLETE_GUIDE.md`](VECTOR_TILES_COMPLETE_GUIDE.md) – comprehensive vector tiles implementation guide
- [`VECTOR_TILES_API.md`](VECTOR_TILES_API.md) – vector tiles API reference and endpoints
- [`VECTOR_TILES_IMPLEMENTATION.md`](VECTOR_TILES_IMPLEMENTATION.md) – vector tiles technical implementation details
- [`MAP_EDITOR_IMPLEMENTATION_SUMMARY.md`](MAP_EDITOR_IMPLEMENTATION_SUMMARY.md) – map editor implementation summary
- [`MAP_EDITOR_SPRINT2_COMPLETE.md`](MAP_EDITOR_SPRINT2_COMPLETE.md) – map editor sprint 2 completion report
- [`MAP_PROJECTION_GUIDE.md`](MAP_PROJECTION_GUIDE.md) – map projection and coordinate systems guide
- [`MAP_DATA_VALIDATION.md`](MAP_DATA_VALIDATION.md) – map data validation procedures
- [`MAPS_MONITORING_GUIDE.md`](MAPS_MONITORING_GUIDE.md) – maps system monitoring and observability
- [`MAPS_OPTIMIZATION_COMPLETE.md`](MAPS_OPTIMIZATION_COMPLETE.md) – maps performance optimization report
- [`MARTIN_TILE_SERVER.md`](MARTIN_TILE_SERVER.md) – Martin tile server configuration and setup
- [`BORDER_EDITING_SYSTEM.md`](BORDER_EDITING_SYSTEM.md) – border editing system architecture
- [`BORDER_EDITING_QUICK_START.md`](BORDER_EDITING_QUICK_START.md) – border editing quick start guide

### Operations & Deployment Reference
- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) – production deployment checklist
- [`PRE_DEPLOYMENT_CHECKLIST.md`](PRE_DEPLOYMENT_CHECKLIST.md) – pre-deployment verification steps
- [`MIGRATION_v1.1_to_v1.2.md`](MIGRATION_v1.1_to_v1.2.md) – version migration guide
- [`TROUBLESHOOTING_v1.2.md`](TROUBLESHOOTING_v1.2.md) – troubleshooting guide for v1.2
- [`CREDENTIALS.md`](CREDENTIALS.md) – credentials and secrets management
- [`PERFORMANCE_BENCHMARKS.md`](PERFORMANCE_BENCHMARKS.md) – performance metrics and benchmarks
- [`EXTERNAL_API_CACHE.md`](EXTERNAL_API_CACHE.md) – external API caching strategies
- [`CACHE_INTEGRATION_EXAMPLE.md`](CACHE_INTEGRATION_EXAMPLE.md) – cache integration implementation examples
- [`IXEARTH_METRICS.md`](IXEARTH_METRICS.md) – IxEarth platform metrics and analytics
- [`WORLD_ROSTER_INTEGRATION.md`](WORLD_ROSTER_INTEGRATION.md) – world roster system integration guide

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

The documentation refresh targets accuracy as of October 22, 2025 (v1.1.3). Treat the structure as the source of truth going forward.
