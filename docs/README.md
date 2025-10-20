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

## How to Maintain This Documentation
1. Update Markdown alongside code changes—especially READMEs in feature directories and the relevant system guide.
2. Run or extend automation in `scripts/audit` when adding routers, models, or calculations; capture outputs in the reference docs.
3. Keep `/help` synchronized with the Markdown guides so users receive the same guidance in-app and in the repository.
4. Move outdated docs to `docs/archive/<date>` instead of deleting them when retiring features.

The documentation refresh targets accuracy as of this commit. Treat the structure as the source of truth going forward.
