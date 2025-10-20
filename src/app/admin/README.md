# Admin Dashboard

**Last updated:** October 2025

The admin interface at `/admin` provides system operators with visibility into calculations, time controls, configuration, and user-country assignments.

## Scope
- Review system status, calculation logs, and key metrics
- Adjust IxTime (pause/resume/set custom time) and trigger Discord bot syncs
- Import roster data and run bulk recalculations
- Manage user→country assignments and favourites
- Inspect formulas, configuration, and environment health

## Key Files
| Path | Purpose |
| --- | --- |
| `src/app/admin/page.tsx` | React page composing admin panels |
| `src/server/api/routers/admin.ts` | tRPC router for admin-only operations (status, time management, imports, config) |
| `src/server/api/routers/users.ts` | Supplemental user assignment and analytics endpoints |
| `scripts/audit/*` | CLI tooling surfaced from the admin experience for deeper checks |

## Permissions
- Only Clerk users with admin-level roles should access this route. Middleware enforces `protectedProcedure` guards on backend endpoints.
- Before extending admin capabilities, ensure proper role checks exist and update environment/security docs.

## Maintenance Checklist
- Update `docs/operations/monitoring.md` when adding new panels or metrics
- Add tests covering new admin mutations or actions
- Keep help content in sync (`/help/technical/administrator-tools` once created)

Treat this README as the quick reference for developers modifying admin functionality.
