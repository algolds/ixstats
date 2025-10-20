# IxStats Documentation Index (2025 Refresh)

This index mirrors the new documentation structure. Use it as the canonical map when authoring, reviewing, or discovering guidance.

## Quick Links
- **Project Overview** – [`docs/overview/platform.md`](overview/platform.md)
- **Feature Map** – [`docs/overview/feature-map.md`](overview/feature-map.md)
- **API Reference** – [`docs/reference/api.md`](reference/api.md)
- **Database Reference** – [`docs/reference/database.md`](reference/database.md)
- **Environment Reference** – [`docs/operations/environments.md`](operations/environments.md)
- **Help System Authoring** – [`docs/systems/help.md`](systems/help.md)

## Category Breakdown

### Overview
| Document | Summary |
| --- | --- |
| [`overview/platform.md`](overview/platform.md) | Product focus, personas, and release positioning |
| [`overview/feature-map.md`](overview/feature-map.md) | Inventory of routes, components, hooks, routers, and supporting scripts |

### Architecture
| Document | Summary |
| --- | --- |
| [`architecture/frontend.md`](architecture/frontend.md) | App Router layout, design system, and UI composition guidelines |
| [`architecture/backend.md`](architecture/backend.md) | tRPC composition patterns, middleware, rate limits, and auth context |
| [`architecture/data.md`](architecture/data.md) | Prisma schema domains, migrations, seed/backup routines |

### Systems
| Document | Summary |
| --- | --- |
| [`systems/mycountry.md`](systems/mycountry.md) | Executive dashboard, compliance tooling, and analytics orchestration |
| [`systems/intelligence.md`](systems/intelligence.md) | Live intelligence feeds, diplomatic briefings, and forecasting services |
| [`systems/diplomacy.md`](systems/diplomacy.md) | Embassy network, mission lifecycle, cultural exchanges, and influence metrics |
| [`systems/economy.md`](systems/economy.md) | Economic indicators, projections, and builder integration |
| [`systems/defense.md`](systems/defense.md) | Strategic defense initiative modules, readiness scores, and crisis response |
| [`systems/social.md`](systems/social.md) | ThinkPages, ThinkShare, activity feeds, and collaborative research tools |
| [`systems/achievements.md`](systems/achievements.md) | Achievement unlock logic, leaderboards, notifications, and analytics |
| [`systems/builder.md`](systems/builder.md) | Nation creation flows, atomic components, wiki importers |
| [`systems/help.md`](systems/help.md) | Help center architecture, article conventions, and synchronization with `/help` |

### Operations & Processes
| Document | Summary |
| --- | --- |
| [`operations/environments.md`](operations/environments.md) | Environment tiers, base paths, service toggles, and secret requirements |
| [`operations/deployment.md`](operations/deployment.md) | Build pipeline, scripts, hosting expectations, and rollback plan |
| [`operations/monitoring.md`](operations/monitoring.md) | Error logging, Discord webhooks, audit scripts, and health checks |
| [`processes/testing.md`](processes/testing.md) | Test strategy, coverage goals, fixtures, and nightly automation |
| [`processes/contributing.md`](processes/contributing.md) | Contribution workflow, review protocol, release cadence |

### Reference
| Document | Summary |
| --- | --- |
| [`reference/api.md`](reference/api.md) | Generated table of routers, procedures, input/output, and auth requirements |
| [`reference/database.md`](reference/database.md) | Prisma models, relations, derived views, and data ownership |
| [`reference/events.md`](reference/events.md) | WebSocket channels, notification payloads, cron/scheduled jobs |

## Legacy Material
- All previous documentation remains available under [`docs/archive/v1`](archive/v1/)
- Each legacy file retains original metadata for historical audits
- When migrating content, copy authoritative sections into the new structure and link the legacy file in the "History" appendix of the new doc

## Maintenance Checklist
1. Update the relevant category table when adding, renaming, or archiving docs
2. Keep "Quick Links" aligned with the most-used references (review quarterly)
3. Ensure new modules have a corresponding entry in both the `systems` guide and the `/help` center
4. Link to automation outputs (JSON/CSV) when generating references via scripts in `scripts/audit`

This index should always reflect the active documentation landscape. Treat it as part of definition-of-done for every feature landing in IxStats.
