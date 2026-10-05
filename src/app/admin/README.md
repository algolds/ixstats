# Admin Dashboard

**Last updated:** September 2026

The admin console at `/admin` is the operator surface for IxStats. It exposes **37 top-level route directories** with a `page.tsx` under `src/app/admin/` (42 `page.tsx` files including the root and the nested `diplomatic-options/analytics`, `diplomatic-scenarios/analytics`, `maps/editor` and `maps/style-editor`). Every route except the two map editors renders the shared `AdminRouter`, which picks the active section from the pathname (39 sections + the dashboard). Navigation between areas is the sidebar's Admin area list: plain Next `Link`s, so each move is a normal route transition. The console renders no navigation of its own.

## Scope
- Review system status, calculation logs, live dashboard metrics, and health
- Control IxTime and the Discord bot (process, commands/roles, sync); manage Thinkpages→Discord feed
- Import roster data, run god-mode country edits, audits, announcements, and scenarios
- Manage user↔country mapping, roles, realms, and membership tiers
- Edit world-sim calculation formulas and reference data
- Curate dynamic game content: government / economic components, economic archetypes, diplomatic options & scenarios, military equipment, NPC personalities, intelligence templates, national issues
- Manage cards/vault (incl. NationStates card import and lore card batch generation), polls, blurbs, achievements/awards, and notifications
- Run WikiOS tooling: wiki link status, LoreScanner, Commons image repository, Loreward weights and article awards
- Labs panels: MyLeague, Narrator, Onoma, Facet lab

## Admin Directories
All routes below render `AdminRouter`; the section panel is chosen by `AdminRouter.renderContent()`. Only `maps/editor` and `maps/style-editor` render their own page content.

| Directory | Section panel / purpose |
| --- | --- |
| `(root) page.tsx` | Live admin dashboard (`LiveAdminDashboard`) — default section |
| `platform/` | Platform health / system validation (`PlatformSettingsPanel`) |
| `autosave-monitor/` | Platform panel, autosave tab |
| `countries/` | God-mode country data, roster import, grid/detail, audit, announcements (`CountriesAdminPanel`) |
| `bot/` | Discord bot integration center (process, commands, sync) |
| `notifications/` | Notification administration |
| `logs/` | System / calculation / user log viewer (`LogsPanel`) |
| `realms/` | Realms, nation claims queue + user→realm assignments |
| `storyteller/` | Storyteller world events / event chains |
| `maps/` | World Studio panel; `maps/editor/` and `maps/style-editor/` are full-page editors (own error boundary) |
| `reference-data/` | Reference data management hub |
| `national-issues/` | National issues templates |
| `rings-audit/` | Health-ring data audit |
| `government-components/` | Atomic government building-block CRUD |
| `economic-components/` | Economic policy component CRUD (incl. tax impact) |
| `economic-archetypes/` | Economy templates / preset component sets |
| `diplomatic-options/` | Diplomatic action CRUD (+ `analytics/`) |
| `diplomatic-scenarios/` | Diplomatic scenario templates (+ `analytics/`) |
| `military-equipment/` | Equipment catalog (`MilitaryEquipmentPanel`) |
| `npc-personalities/` | NPC personality traits / archetypes |
| `intelligence-templates/` | Intelligence briefing templates |
| `cards/` | Vault card management, NS card import (`CardImportStudio`), lore card batch generator (`LoreCardBatchAdmin`) |
| `vault/` | IxVault administration |
| `stash/` | Stash settings |
| `polls/` | Polls management |
| `blurbs/` | Blurbs management |
| `achievements/` | Achievements and article awards (`AwardsManagerSection`) |
| `thinkpages/` | ThinkPages content settings |
| `membership/` | Membership tier management |
| `users/` | User list / management (`UserManagement mode="users"`) |
| `user-roles/` | Role assignment (`UserManagement mode="roles"`) |
| `wikios-settings/` | WikiOS utilities deck, wiki link status, manual link editor, system tuning (incl. Loreward weights) |
| `lorescanner/` | WikiOS bulk wiki-link scanner |
| `image-repo/` | WikiOS Commons repository / flag cache |
| `myleague/` | MyLeague admin panel (Labs) |
| `narrator/` | Narrator admin panel (Labs) |
| `onoma/` | Onoma admin panel (Labs) |
| `facet-lab/` | Facet design-system lab (`facet-materials-lab/FacetLabPanel`) |

Directories without a `page.tsx`: `calculations/` (formula editor components; the `calculations` section is reachable from the sidebar, but a hard load of `/admin/calculations` has no route), `facet-materials-lab/` (lab components), `wiki/components/` (sections used by `wikios-settings`, `lorescanner`, `achievements`), `_components/`, `_hooks/`.

> Removed since the June README: `settings/`, `system-validation/`, `user-logs/`, `worldstudio/`, `card-packs/`, `lorewards/`, `user-management/`, `wiki/` (page), `facet-materials-lab/` (page), `studio/`, and earlier `tax-components/`, `card-balancer/`, `crisis-events/`, `ns-sync/`, `lore-cards/`. Added: `narrator/`, `onoma/`.

## Architecture & Auth

- **Shared layout guard** — `src/app/admin/layout.tsx` enforces access before rendering any admin route. It requires a signed-in Clerk user who is either a system owner (`isSystemOwner(user.id)`) **or** has a role `∈ {admin, owner, staff}` in Clerk `publicMetadata.role` or in the database role. Anyone else sees the `AccessDeniedScreen`; signed-out users get a sign-in modal.
- **System owner** — `src/lib/auth/system-owner-constants.ts` defines `SYSTEM_OWNER_IDS` and `isSystemOwner()`, which audit-logs owner access in production.
- **Section router**: `_components/AdminRouter.tsx` + `_components/AdminNavigationContext.tsx` (`useAdminNavigation`) derive the active section straight from the pathname (no state copy, so a new page never renders the previous section) and set the per-section document title; the dashboard's tiles can also switch section in place with `pushState`. Section panels are `dynamic()`-imported (`ssr: false`) for code-splitting. The sidebar's Admin area list in `app-sections.ts` is the only navigation between sections.
- **Exceptions to the router** — `maps/editor` and `maps/style-editor` bypass the sidebar layout and render inside an `AdminErrorBoundary` directly.

## Data Sources

The admin tRPC router was split by domain on 2026-06-13 and recombined with `mergeRouters`, preserving every `api.admin.*` path (registered as `admin` in `src/server/api/root.ts`).

| File (`src/server/api/routers/admin/`) | Domain |
| --- | --- |
| `system.ts` | config, status, health, stats, logs, calculations, time control |
| `bot.ts` | Discord bot control, process management, commands/roles, sync |
| `users.ts` | user↔country mapping/assignment, navigation visibility settings |
| `countries/` | god-mode country data, roster import, grid/detail, audit, announcements, scenarios |
| `worldEvents.ts` | storyteller world events, event chains, diplomatic options, upcoming events |
| `wiki.ts` | wiki links, article awards, loreward scoring, templates, cache purges, wiki users |
| `cron.ts` | cron schedules (`getCronSchedules`, `saveCronSchedules`) |
| `stash.ts` | Stash settings |
| `thinkpages.ts` | ThinkPages content settings |
| `thinkpagesDiscordFeed.ts` | Thinkpages → Discord feed configuration |

`_config-kv.ts` is a shared helper, not a router. `api.admin.*` exposes ~78 procedures across these files. Map admin is served separately by `geoAdmin` (`geo/admin` + `geo/admin/cities`). Supplemental user analytics/assignment endpoints live in `api.users.*` and `api.countries.*`.

## Maintenance

- Update `docs/systems/admin-cms.md` when adding or removing admin interfaces, and keep this directory table in sync with `AdminRouter.renderContent()` and the Admin sections in `src/lib/navigation/app-sections.ts` (the sidebar area list).
- New admin mutations must go through a domain service and be guarded; never bypass the layout auth check.
- Register any new admin router file in `routers/admin/index.ts` and verify procedure parity at the AST level after splitting (`scripts/verify-router-splits.ts`).
