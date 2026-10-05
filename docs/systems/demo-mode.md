# Demo Mode

**Last updated:** 2026-10-05
**Status:** Read-side only. The switch that shows a demo country to system owners exists, but nothing in the repo can
turn it on or create a demo country.
**Routes:** no page of its own. Affects `/mycountry/**`.
**Code:** `src/server/api/routers/demo-mode.ts`, `src/context/DemoModeContext.tsx`, `src/app/mycountry/layout.tsx`,
`src/components/mycountry/shared/primitives/CountryDataProvider.tsx`

Demo mode lets a system owner view MyCountry as a seeded demo country instead of their own. The state is two
`SystemConfig` rows; the demo country is a `Country` with `isDemo: true`.

---

## 1. How it works

| Piece | Behaviour |
| :--- | :--- |
| `SystemConfig` `demo_mode_active` | `"true"` turns demo mode on |
| `SystemConfig` `demo_country_id` | The demo country's id |
| `demoMode.getDemoState` | Returns `{ isActive, demoCountryId }` |
| `DemoModeProvider` (mounted by `src/app/mycountry/layout.tsx`) | Queries `getDemoState` when signed in (30-second stale time) and exposes `useDemoMode()` |
| `CountryDataProvider` | When demo mode is active, loads `demoCountryId` instead of the dev "view as" country or the user's own country. An explicit `countryId` prop still wins |
| `DemoModeBanner` | A sticky status bar on MyCountry: "Demo mode. You're viewing seeded demo data; changes aren't saved." |

## 2. The guard

`getDemoState` is a `protectedProcedure`. It returns real state only when `isSystemOwner(ctx.auth.userId)` is true,
meaning the Clerk id is listed in the `SYSTEM_OWNER_IDS` environment variable (`src/lib/auth/system-owner-constants.ts`).
Everyone else always gets `{ isActive: false, demoCountryId: null }`.

There is **no environment guard**. The router and `DemoModeProvider` run the same way in production and development;
the system-owner check is the only gate. When the flag is on but no `isDemo` country has the configured id, the
procedure sets `demo_mode_active` back to `"false"` and reports inactive.

Other routers keep demo countries out of public lists by filtering `isDemo: false`: `countries.getAll`,
`getTopCountriesByImportance`, `getTopCountriesByPopulation`, `getRandomCountries`, `countries.getGlobalStats`, and the
map editor's linkage validation. The admin country grid shows the `isDemo` flag.

## 3. Procedures

| Procedure | Auth | Notes |
| :--- | :--- | :--- |
| `demoMode.getDemoState` | protected; real data for system owners only | The only procedure in the router |

There is no procedure to turn demo mode on or off, and none to create or reset the demo country.

## 4. Jobs

None.

## 5. Known gaps

- **Nothing can activate it.** No code writes `demo_mode_active` or `demo_country_id` except the clean-up above, and no
  code creates an `isDemo` country. The `DemoSeedService` that once cloned the demo country is gone (only
  `src/lib/demo-seed/seed-sports.ts` and `sports/` remain, used for sports seeding). The comments in
  `src/server/db.ts` that mention demo seeding are leftovers.
- **"Changes aren't saved" is not enforced.** No mutation checks `isDemo`, so a write made while viewing the demo
  country goes through like any other write.
- The router's header comment ("Admin-only endpoints… Creates a cloned demo country") describes the removed seeding,
  not the current code.

## Related documentation

- [MyCountry](./mycountry.md)
- [Platform audit, ponytail D4](../roadmap/platform-audit/ponytail.md): the demo-seed removal
