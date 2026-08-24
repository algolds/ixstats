# Admin Dashboard

**Last updated:** June 2026

The admin console at `/admin` is the operator surface for IxStats. It currently exposes **47 top-level route directories** under `src/app/admin/` (51 including nested sub-routes such as analytics and map editors) — not the "28" stated by earlier revisions of this file. Most routes are thin: their `page.tsx` renders the shared `AdminRouter`, which switches on the active section, so navigation between admin areas is instant (no Next.js route transition). A handful of feature-heavy areas (countries, diplomatic options/scenarios, military equipment, NPC personalities, maps) ship their own page content and auth guard.

## Scope
- Review system status, calculation logs, live dashboard metrics, and health
- Control IxTime and the Discord bot (process, commands/roles, sync); manage Thinkpages→Discord feed
- Import roster data, run god-mode country edits, audits, announcements, and scenarios
- Manage user↔country mapping, roles, realms, and membership tiers
- Edit world-sim calculation formulas and reference data
- Curate dynamic game content: government / economic components, economic archetypes, diplomatic options & scenarios, military equipment, NPC personalities, intelligence templates, national issues
- Manage cards/vault, lore cards, polls, blurbs, achievements/awards, and notifications
- Run WikiOS tooling: wiki link status, LoreScanner, Commons image repository, wiki awards

## Admin Directories
Routes whose `page.tsx` defers to `AdminRouter` are marked **(router)**; the section is rendered by `AdminRouter.renderContent()`. Pages with their own content/auth are marked **(standalone)**.

| Directory | Purpose |
| --- | --- |
| `(root) page.tsx` | Live admin dashboard (`LiveAdminDashboard`) — default section |
| `settings/` | General platform settings **(router)** |
| `platform/` | Platform health / system validation hub (system-validation merged here) **(standalone)** |
| `system-validation/` | Redirect → `platform` |
| `bot/` | Discord bot integration center (process, commands, sync) **(router)** |
| `notifications/` | Notification administration **(router)** |
| `logs/` | System / calculation log viewer **(router)** |
| `user-logs/` | User activity log viewer (`LogsPanel`) **(router)** |
| `world-settings/` | World config (merged into `realms` World Configs tab) **(router)** |
| `realms/` | Game realms + user→realm assignments **(router)** |
| `storyteller/` | Storyteller world events / event chains **(router)** |
| `worldstudio/` | World Studio map authoring panel **(router)** |
| `reference-data/` | Reference data management hub **(router)** |
| `national-issues/` | National issues templates **(router)** |
| `calculations/` | Calculation formula editor (router-only section, no dir) |
| `countries/` | God-mode country data, roster import, grid/detail, audit, announcements **(standalone)** |
| `government-components/` | Atomic government building-block CRUD **(standalone)** |
| `economic-components/` | Economic policy component CRUD **(standalone)** |
| `economic-archetypes/` | Economy templates / preset component sets **(standalone)** |
| `diplomatic-options/` | Diplomatic action CRUD + `analytics/` **(standalone)** |
| `diplomatic-scenarios/` | Diplomatic scenario templates + `analytics/` **(standalone)** |
| `military-equipment/` | Equipment catalog + `small-arms/`, `manufacturers/`, `analytics/` **(standalone)** |
| `npc-personalities/` | NPC personality traits / archetypes, clone & assign **(standalone)** |
| `intelligence-templates/` | Intelligence briefing templates **(standalone)** |
| `ns-sync/` | NationStates data synchronization **(standalone)** |
| `autosave-monitor/` | Autosave system health / failure analysis **(standalone)** |
| `lore-cards/` | Lore card `batch-generator/` from wiki content **(standalone)** |
| `cards/` | Vault card management (`card-packs/` redirects to `cards?tab=packs`) **(router)** |
| `card-packs/` | Redirect → `cards?tab=packs` |
| `vault/` | IxVault administration **(router)** |
| `stash/` | Stash settings **(router)** |
| `polls/` | Polls management **(router)** |
| `blurbs/` | Blurbs management **(router)** |
| `achievements/` | Achievements / awards & system points (`AwardsManagerSection`) **(router)** |
| `lorewards/` | Loreward scoring (renders null / handled via wiki router) |
| `thinkpages/` | ThinkPages content settings **(router)** |
| `membership/` | Membership tier management **(standalone)** |
| `user-management/` | User list / management (`UserManagement mode="users"`) **(router)** |
| `user-roles/` | Role assignment (`UserManagement mode="roles"`) **(router)** |
| `users/` | Legacy user analytics route **(standalone)** |
| `maps/` | Atlas map admin + `editor/`, `style-editor/` (own error boundary) **(standalone)** |
| `wiki/` | Wiki link status, manual link editor, system tuning **(router)** |
| `wikios-settings/` | WikiOS base settings (link status + editor + tuning) **(router)** |
| `lorescanner/` | WikiOS bulk wiki-link scanner **(router)** |
| `image-repo/` | WikiOS Commons repository / flag cache (`UnifiedMediaServiceAdmin`) **(router)** |
| `myleague/` | MyLeague admin panel (Labs) **(router)** |
| `facet-lab/` | Facet design-system lab **(router)** |
| `facet-materials-lab/` | Facet materials lab (`FacetLabPanel`) **(router)** |
| `studio/` | Content studio **(standalone)** |
| `rings-audit/` | Health-ring data audit (`HealthRing` debug view) **(standalone)** |

> Removed since the prior README: `tax-components/`, `card-balancer/`, and `crisis-events/` no longer exist as admin routes. Tax editing now lives within `economic-components` (Tax Impact). The prior "28 / + 7 more" table is superseded by the full list above.

## Architecture & Auth

- **Shared layout guard** — `src/app/admin/layout.tsx` enforces access before rendering any admin route. It requires a signed-in Clerk user who is either a system owner (`isSystemOwner(user.id)`) **or** carries `publicMetadata.role ∈ {admin, owner, staff}`. Anyone else sees the `AccessDeniedScreen`; signed-out users get a sign-in modal.
- **System owner** — `src/lib/system-owner-constants.ts` defines `SYSTEM_OWNER_IDS` and `isSystemOwner()`, which audit-logs owner access in production.
- **Single-page router** — `_components/AdminRouter.tsx` + `_components/AdminNavigationContext.tsx` (`useAdminNavigation`) drive section state and URL sync via `window.history.pushState()` with a `popstate` listener. Section panels are `dynamic()`-imported (`ssr: false`) for code-splitting.
- **Exceptions to the router** — `maps/editor` and `maps/style-editor` bypass the sidebar layout and render inside an `AdminErrorBoundary` directly. The standalone content routes above guard themselves.

## Data Sources

The admin tRPC router was split by domain on 2026-06-13 and recombined with `mergeRouters`, preserving every `api.admin.*` path (registered in `src/server/api/root.ts` via `safeRouter("admin", …)`).

| File (`src/server/api/routers/admin/`) | Domain |
| --- | --- |
| `system.ts` | config, status, health, stats, logs, calculations, time control |
| `bot.ts` | Discord bot control, process management, commands/roles, sync |
| `users.ts` | user↔country mapping/assignment, navigation visibility settings |
| `countries/` | god-mode country data, roster import, grid/detail, audit, announcements, scenarios |
| `worldEvents.ts` | storyteller world events, event chains, diplomatic options, upcoming events |
| `wiki.ts` | wiki links, article awards, loreward scoring, templates, cache purges, cron, wiki users |
| `thinkpagesDiscordFeed.ts` | Thinkpages → Discord feed configuration |

`api.admin.*` exposes ~83 procedures across these files. Map admin is served separately by `geoAdmin` (`geo/admin` + `geo/admin/cities`). Supplemental user analytics/assignment endpoints live in `api.users.*` and `api.countries.*`.

## Maintenance

- Update `docs/systems/admin-cms.md` when adding or removing admin interfaces, and keep this directory table in sync (it drifted to "28" while the real count is 47).
- New admin mutations must go through a domain service and be guarded; never bypass the layout auth check.
- Register any new admin router file in `routers/admin/index.ts` and verify procedure parity at the AST level after splitting (`scripts/verify-router-splits.ts`).
