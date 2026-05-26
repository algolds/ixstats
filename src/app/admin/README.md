# Admin Dashboard

**Last updated:** May 2026

The admin interface at `/admin` provides system operators with 28 CMS interfaces for visibility into calculations, time controls, configuration, user management, reference data, and content management.

## Scope
- Review system status, calculation logs, and key metrics
- Adjust IxTime (pause/resume/set custom time) and trigger Discord bot syncs
- Import roster data and run bulk recalculations
- Manage user→country assignments and favourites
- Inspect formulas, configuration, and environment health
- Manage reference data (government components, economic components, diplomatic options, etc.)
- Configure NPC personality traits and archetypes
- Manage military equipment catalogs
- Monitor and manage national issues templates

## Admin Directories (28)
| Directory | Purpose |
| --- | --- |
| `achievements/` | Achievement management |
| `autosave-monitor/` | Autosave system health monitoring |
| `card-balancer/` | Card balance tuning |
| `countries/` | Country management and data |
| `crisis-events/` | Crisis event template management |
| `diplomatic-options/` | Diplomatic action CRUD and analytics |
| `diplomatic-scenarios/` | Diplomatic scenario templates |
| `economic-archetypes/` | Economic archetype definitions |
| `economic-components/` | Economic policy component management |
| `government-components/` | Government building block management |
| `intelligence-templates/` | Intelligence briefing templates |
| `lore-cards/` | Lore card batch generation |
| `maps/` | IxWorld map administration |
| `membership/` | User role and permission management |
| `military-equipment/` | Military equipment catalog (including small arms) |
| `national-issues/` | National issues template CRUD |
| `npc-personalities/` | NPC personality trait configuration |
| `ns-sync/` | NationStates data synchronization |
| `tax-components/` | Tax system component management |
| `thinkpages/` | ThinkPages content management |
| `users/` | User analytics and management |
| + 7 more | Various admin tools and monitoring interfaces |

## Key Files
| Path | Purpose |
| --- | --- |
| `src/app/admin/page.tsx` | React page composing admin panels |
| `src/app/admin/_components/` | Shared admin UI components |
| `src/app/admin/_hooks/` | Shared admin hooks |
| `src/server/api/routers/admin.ts` | tRPC router for admin-only operations (status, time management, imports, config) |
| `src/server/api/routers/users.ts` | Supplemental user assignment and analytics endpoints |
| `scripts/audit/*` | CLI tooling surfaced from the admin experience for deeper checks |

## Permissions
- Only Clerk users with admin-level roles should access this route. Middleware enforces `protectedProcedure` and `adminProcedure` guards on backend endpoints.
- Before extending admin capabilities, ensure proper role checks exist and update environment/security docs.

## Maintenance Checklist
- Update `docs/systems/admin-cms.md` when adding new admin interfaces
- Add tests covering new admin mutations or actions
- Keep help content in sync (`/help/technical/administrator-tools` once created)

Treat this README as the quick reference for developers modifying admin functionality.
