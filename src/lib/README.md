# Library Overview (`src/lib`)

**Last updated:** October 2025

`src/lib` hosts utilities, services, and domain helpers shared across the application. Modules are grouped by concern and are safe to import from both server and client code unless otherwise noted.

## Categories
| Category | Example Files | Description |
| --- | --- | --- |
| Time & Simulation | `ixtime.ts`, `ixtime-sync.ts`, `ixtime-economic-utils.ts` | Custom IxTime system, synchronization helpers, economic time-scaling |
| Economic & Policy Calculators | `calculations.ts`, `enhanced-economic-calculations.ts`, `predictive-analytics-engine.ts`, `tax-calculator.ts` | Core economic formulas, projections, tax calculations, impact modelling |
| Atomic & Builder Utilities | `atomic-builder-state.ts`, `atomic-economic-integration.ts`, `atomic-tax-integration.ts`, `builder-policy-integration.ts` | Supports atomic governance/economic components and builder flows |
| Intelligence & Defense | `intelligence-engine.ts`, `vitality-calculator.ts`, `defense-integration.ts`, `stability-formulas.ts` | Intelligence scoring, vitality metrics, defense readiness |
| Social & Notifications | `notification-api.ts`, `notification-hooks.ts`, `activity-generator.ts`, `user-activity-analytics.ts` | Notification pipeline, activity feeds, analytics |
| Media & Wiki Integration | `mediawiki-service.ts`, `wiki-search-service.ts`, `unified-flag-service.ts`, `flag-color-extractor.ts` | MediaWiki clients, wiki parsing, flag retrieval/caching |
| Infrastructure & Security | `rate-limiter.ts`, `user-logging-middleware.ts`, `error-logger.ts`, `access-control.ts` | Cross-cutting infrastructure helpers |
| Formatting & Utilities | `format-utils.ts`, `chart-utils.ts`, `url-utils.ts`, `utils.ts` | Formatting, chart helpers, misc utilities |

## Guidelines
- Prefer pure functions that accept/return typed objects; side effects should be isolated in services
- Keep browser-only utilities (`performance-monitor.tsx`, etc.) separated from Node-only modules (`intelligence-broadcast-service.ts`)
- Update `docs/architecture/backend.md` or relevant system docs when adding significant new helpers
- Add tests under `src/lib/__tests__` for complex calculations or logic changes

## Related Directories
- `src/lib/services/` – Higher-level service orchestrators
- `src/lib/transformers/` – Data transformation helpers for API responses
- `src/lib/websocket/` – Client helpers for realtime channels (production only)

Treat this README as the map for shared utilities. Keep it in sync as modules are added, renamed, or retired.
