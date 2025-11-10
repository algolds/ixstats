# IxStats Documentation Index (2025 Refresh)

This index mirrors the new documentation structure. Use it as the canonical map when authoring, reviewing, or discovering guidance.

## Quick Links
- **Project Overview** – [`docs/overview/platform.md`](overview/platform.md)
- **Feature Map** – [`docs/overview/feature-map.md`](overview/feature-map.md)
- **API Reference** – [`docs/reference/api.md`](reference/api.md)
- **Database Reference** – [`docs/reference/database.md`](reference/database.md)
- **Environment Reference** – [`docs/operations/environments.md`](operations/environments.md)
- **Help System Authoring** – [`docs/systems/help.md`](systems/help.md)
- **Tax System Reference** – [`TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md`](TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md)
- **Map Editor Guide** – [`VECTOR_TILES_COMPLETE_GUIDE.md`](VECTOR_TILES_COMPLETE_GUIDE.md)
- **Rate Limiting Guide** – [`RATE_LIMITING_GUIDE.md`](RATE_LIMITING_GUIDE.md)

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
| [`systems/myvault.md`](systems/myvault.md) | MyVault economy system, IxCredits currency, earning/spending mechanics, and vault progression |
| [`systems/cards.md`](systems/cards.md) | IxCards system, card types (Nation, Lore, NS Import, Special), rarity mechanics, and ownership tracking |
| [`systems/card-packs.md`](systems/card-packs.md) | Card pack types, rarity distribution, pack opening flow, and bonus mechanics |
| [`systems/ns-integration.md`](systems/ns-integration.md) | NationStates integration, card dump sync, collection import, and rate limiting compliance |

### Operations & Processes
| Document | Summary |
| --- | --- |
| [`operations/environments.md`](operations/environments.md) | Environment tiers, base paths, service toggles, and secret requirements |
| [`operations/deployment.md`](operations/deployment.md) | Build pipeline, scripts, hosting expectations, and rollback plan |
| [`operations/monitoring.md`](operations/monitoring.md) | Error logging, Discord webhooks, audit scripts, and health checks |
| [`RATE_LIMITING_GUIDE.md`](RATE_LIMITING_GUIDE.md) | Rate limiting configuration, Redis setup, endpoint protection, and troubleshooting |
| [`processes/testing.md`](processes/testing.md) | Test strategy, coverage goals, fixtures, and nightly automation |
| [`processes/contributing.md`](processes/contributing.md) | Contribution workflow, review protocol, release cadence |

### Reference
| Document | Summary |
| --- | --- |
| [`reference/api.md`](reference/api.md) | Generated table of routers, procedures, input/output, and auth requirements |
| [`reference/database.md`](reference/database.md) | Prisma models, relations, derived views, and data ownership |
| [`reference/events.md`](reference/events.md) | WebSocket channels, notification payloads, cron/scheduled jobs |
| [`SYNERGY_REFERENCE.md`](SYNERGY_REFERENCE.md) | Government component synergy system and interaction patterns |
| [`ADMIN_ENDPOINT_SECURITY_MAP.md`](ADMIN_ENDPOINT_SECURITY_MAP.md) | Admin endpoint security mappings and authentication requirements |
| [`USER_PROFILE_UTILS_USAGE.md`](USER_PROFILE_UTILS_USAGE.md) | User profile utilities and display name implementation |
| [`DEV_DATABASE_SETUP.md`](DEV_DATABASE_SETUP.md) | Development database setup and management guide |
| [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) | Comprehensive API documentation and usage patterns |

### Tax System Reference
| Document | Summary |
| --- | --- |
| [`TAX_SYSTEM_PERSISTENCE.md`](TAX_SYSTEM_PERSISTENCE.md) | Tax system persistence architecture and implementation |
| [`TAX_SYSTEM_DATA_STRUCTURE.md`](TAX_SYSTEM_DATA_STRUCTURE.md) | Tax system data structures and type definitions |
| [`TAX_SYSTEM_FRONTEND_EXAMPLE.md`](TAX_SYSTEM_FRONTEND_EXAMPLE.md) | Tax system frontend integration examples |
| [`TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md`](TAX_SYSTEM_IMPLEMENTATION_SUMMARY.md) | Complete tax system implementation summary |

### Map Editor & Vector Tiles Reference
| Document | Summary |
| --- | --- |
| [`VECTOR_TILES_COMPLETE_GUIDE.md`](VECTOR_TILES_COMPLETE_GUIDE.md) | Comprehensive vector tiles implementation guide |
| [`VECTOR_TILES_API.md`](VECTOR_TILES_API.md) | Vector tiles API reference and endpoints |
| [`VECTOR_TILES_IMPLEMENTATION.md`](VECTOR_TILES_IMPLEMENTATION.md) | Vector tiles technical implementation details |
| [`MAP_EDITOR_IMPLEMENTATION_SUMMARY.md`](MAP_EDITOR_IMPLEMENTATION_SUMMARY.md) | Map editor implementation summary |
| [`MAP_EDITOR_SPRINT2_COMPLETE.md`](MAP_EDITOR_SPRINT2_COMPLETE.md) | Map editor sprint 2 completion report |
| [`MAP_PROJECTION_GUIDE.md`](MAP_PROJECTION_GUIDE.md) | Map projection and coordinate systems guide |
| [`MAP_DATA_VALIDATION.md`](MAP_DATA_VALIDATION.md) | Map data validation procedures |
| [`MAPS_MONITORING_GUIDE.md`](MAPS_MONITORING_GUIDE.md) | Maps system monitoring and observability |
| [`MAPS_OPTIMIZATION_COMPLETE.md`](MAPS_OPTIMIZATION_COMPLETE.md) | Maps performance optimization report |
| [`MARTIN_TILE_SERVER.md`](MARTIN_TILE_SERVER.md) | Martin tile server configuration and setup |
| [`BORDER_EDITING_SYSTEM.md`](BORDER_EDITING_SYSTEM.md) | Border editing system architecture |
| [`BORDER_EDITING_QUICK_START.md`](BORDER_EDITING_QUICK_START.md) | Border editing quick start guide |

### Operations & Deployment Reference
| Document | Summary |
| --- | --- |
| [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) | Production deployment checklist |
| [`PRE_DEPLOYMENT_CHECKLIST.md`](PRE_DEPLOYMENT_CHECKLIST.md) | Pre-deployment verification steps |
| [`MIGRATION_v1.1_to_v1.2.md`](MIGRATION_v1.1_to_v1.2.md) | Version migration guide |
| [`TROUBLESHOOTING_v1.2.md`](TROUBLESHOOTING_v1.2.md) | Troubleshooting guide for v1.2 |
| [`CREDENTIALS.md`](CREDENTIALS.md) | Credentials and secrets management |
| [`PERFORMANCE_BENCHMARKS.md`](PERFORMANCE_BENCHMARKS.md) | Performance metrics and benchmarks |
| [`EXTERNAL_API_CACHE.md`](EXTERNAL_API_CACHE.md) | External API caching strategies |
| [`CACHE_INTEGRATION_EXAMPLE.md`](CACHE_INTEGRATION_EXAMPLE.md) | Cache integration implementation examples |
| [`IXEARTH_METRICS.md`](IXEARTH_METRICS.md) | IxEarth platform metrics and analytics |
| [`WORLD_ROSTER_INTEGRATION.md`](WORLD_ROSTER_INTEGRATION.md) | World roster system integration guide |

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
