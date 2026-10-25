# Countries / Explore

**Last updated:** 24 October 2026

Public, read-only nation profiles. Anyone (signed in or not) can open a country's public profile; the nation list is each realm's Nations tab (`src/app/r/[realm]/(region)/nations`). Owner-side editing lives in MyCountry, not here.

## Routes

| Route                                                       | File                                | Purpose                                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/countries`                                                | `page.tsx`                          | Redirect only: the nation list is the realm's Nations tab (`/r/<realm>/nations`); `?realm=` names the realm, else the viewer's                               |
| `/countries/[slug]`                                         | `[slug]/(profile)/page.tsx`         | The country document on its **Factbook** tab (`?sheet=economy\|state\|foreign`, `&segment=labor`, opens a sheet)                                             |
| `/countries/[slug]/map`                                     | `[slug]/(profile)/map/page.tsx`     | The document on its **Map** tab                                                                                                                              |
| `/countries/[slug]/lore`                                    | `[slug]/(profile)/lore/page.tsx`    | The document on its **Lore** tab                                                                                                                             |
| `/countries/[slug]/history`                                 | `[slug]/(profile)/history/page.tsx` | The document on its **History** tab                                                                                                                          |
| `/countries/[slug]/modeling`                                | `[slug]/modeling/page.tsx`          | Economic scenario sandbox (linked from the Economy & people sheet)                                                                                           |
| `/activity`, `/dossier`, `/factbook`, `/factbook/<section>` | `[slug]/(profile)/…/page.tsx`       | Old addresses: server redirects (`legacyCountryRedirect` in `src/lib/country/country-routes.ts`) to History, Lore, the Economy, Labor or State sheet, or Map |

## Country profile

The country page is **one document, like the passport** (spec: `docs/superpowers/specs/2026-10-24-country-page-passport-design.md`): a face, a ribbon attached to it and one panel, in one card (`_components/CountryDocument.tsx`). Every tab page renders the same `CountryDocument` with its `initialTab`; switching tabs is instant (`history.pushState`, no route transition), each tab keeps its own URL and back/forward follow through `popstate`. Every subject lives in exactly one tab.

The profile shell (`(profile)/layout.tsx`) loads the country (`CountryDataProvider`), shows the breadcrumb (Countries › name) and shares the country, flag, ownership and cover with the document through `ProfileShellProvider` (`_components/ProfileShellContext.tsx`). Every state sits in the full-width page column (`PAGE_COLUMN`).

- **Face** (`ProfileFace` → `ProfileHero`, on `CountryHeroCard` in `src/components/shared/country-hero/` rendered frameless, the frame the dashboard's hero also renders): the live territory map in the media slot (its expand control opens the Map tab; the owner can swap the map for a cover photo, saved per country on that device only, so visitors always see the map), and a panel with the flag, the name with the owner's ribbons, the official name, continent and region, the system of government and the capital as chips, the realm and IxnayID strip (`CountryIdentityStrip`), the face's one button and the dashboard's figures (population, GDP, standing, approval, stability), each opening its public detail sheet. **Country DNA** (`StandingBand`) is the face's footer row: the vitality rings, the strongest World Census ranks and weakest two as chips, and meters for employment, literacy and urbanisation.
- **Actions**: visitors get **Country actions** (`CountryActionsMenu`); the owner gets **Manage**, which turns the face over (the ribbon and panel stay put) to `CountryBackFace`: the private owner strip (`OwnerLayer`), the cover choice (`CoverOptions`) and the country editor.
- **Ribbon** (`DocumentRibbon` in `src/components/shared/document/`, shared with the passport): Factbook · Map · Lore · History.
- **Factbook** (`country-profile/factbook/`): three snapshot blocks (Economy & people, State, Foreign affairs), each a headline figure, a small visual and a few facts, with **More** opening its sheet (`FactbookSheets`): the Economy and Labor sections as two segments (plus the modeling sandbox link), the Government section, or every relation and embassy (`PublicRelationsList`). The sheets mount the factbook metrics only while open.
- **Map** (`country-profile/map/MapTab.tsx`): the interactive territory map with its **Open on map** link to the Maps app (the only one), the land facts led by the area, every region by population and the map stories; choosing a region or a story flies the map to it (`CountryMapEmbed`'s `focus`).
- **Lore** (`country-profile/lore/LoreReader.tsx`): the country's wiki article as WikiOS renders it (`wikios.getArticleHtml`; IxWiki's from Postgres, an Eurth nation's from its own wiki), in WikiOS's article styles (`~/styles/wiki-os.css`), with **Open in WikiOS** and **Edit** above it and WikiOS's contents (`StickyToc`, kept on the section being read by WikiOS's scroll spy) beside it from `lg` up. The infobox (the Factbook holds the facts), the notices and the reader's margin are left out. Native lore is not shown yet: making it shared, WikiOS-friendly content is a separate project.
- **History** (`country-profile/history/`): the chronicle and the activity feed as one timeline on the in-game calendar (`mergeTimeline`), newest first, with All · Record · Posts · Economic · Diplomatic · Social and a 7/30/90-day range that narrows the feed only.

Pure derivations live in `src/components/country-profile/derive.ts` (`toDnaAxes`, `standingHighlights`, `conditionPillars`, `regionShares`, `earliestFounding`, `stateLeaders`, `diplomaticMatrix`, `relationNodes`), `history/merge-timeline.ts` and `src/lib/country/country-routes.ts`, tested in `src/tests/components/country-profile/` and `src/tests/lib/country-routes.test.ts`.

**Reading style.** Lore is set by WikiOS's own article styles (`.wikios-article-content`, the wiki Reading face) at a 44rem measure. Titles use Facet text styles; figures use tabular numerals, in `label` colours: the realm tint paints bars, rules and fills, never text. The unloaded Baskerville serif is not used (pinned in `facet-guards.test.ts`).

### Data layer

The profile renders one model built by `_hooks/useCountryProfileLayer.ts`, which runs the public queries in parallel; the pure parts (wiki parsing, chronicle merge, formatters) live in `_utils/profileLayer.ts` and are unit tested in `src/tests/app/countries/profile-layer.test.ts`. Shared pieces are in `src/components/country-profile/`.

**Real data only.** Every figure comes from a router; a missing source renders an `EmptyState` or drops the section — never a sample figure.

**Visibility: public record only, enforced on the server.** Visitors — signed in or not — see lore, stats, enacted directives (`active`/`completed`), resolved national issues (`responded`/`auto_resolved`) with the decision taken, its outcome and when it was resolved, the World Census, relations and embassies, all from **`countries.getPublicRecord`** (a `publicProcedure`; rules in `src/lib/country/public-record.ts`). Drafts, abandoned directives, open/expired/dismissed issues, package line items, executive bandwidth, budgets and applied consequences never leave the server. The other readers were tightened to match:

- `intent.getTree` returns the full tree only to the nation's owner (the user acting as it or its `ownerUserId`) and privileged roles; anyone else gets enacted directives only, with `changesJson`, `execBandwidthCost` and `cooldownUntil` redacted.
- `nationalIssues.getHistory` is FORBIDDEN unless the caller owns the nation or holds a privileged role (`assertCountryWriteAccess`).
- Budgets: `government.getByCountryId` (the State structure) returns offices, leaders, branches and departments to everyone, but `totalBudget`, allocations, sub-budgets and revenue sources only to the owner and privileged roles; `countries.getByIdWithEconomicData` drops the sector spending split (`governmentBudget`, `fiscalSystem.spendingByCategory`) for visitors, so the factbook's Public Budget section shows the macro totals and hides the allocation card; `mycountry.getCanonFeed` drops entries tied to non-public directives and budget ledger rows. The full list is in [MyCountry](../../../docs/systems/mycountry.md) ("Budgets are private").
- The rest of the owner's side is owner/privileged only too: every other `nationalIssues` player procedure (open issues, issue detail, pending count, respond/dismiss/mark viewed, recon), `intent.suggest`, `intent.getStatus`, `intent.getLinkedIssues` and `policies.getPolicyReconContext` (executive bandwidth). `intent.getOutcome` answers for enacted directives only unless the caller owns the nation, and `policies.getPolicies` drops drafts for non-owners. Full list in [MyCountry](../../../docs/systems/mycountry.md) (Visibility); tested in `src/tests/server/api/routers/country-private-record.test.ts`.

Tested in `src/tests/server/api/routers/country-public-record.test.ts`. When the signed-in viewer owns the country (`userProfile.countryId === country.id`), a tinted "Only you can see this" strip adds open-issue, draft and in-force directive counts (from the owner's own `intent.getTree` and `nationalIssues.getPendingCount`) and a link to MyCountry.

| Part                                                                      | Source                                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                                                                  | `country.nationalIdentity` (via `countries.getByIdWithEconomicData`), then `wikiCache.getCountryProfile` infobox                                              |
| Lore (the article)                                                        | `wikios.getArticleHtml` (IxWiki from Postgres, following `#REDIRECT`; another wiki's page rendered by that wiki's parser), read by the Lore tab itself        |
| Vitals, condition, economy trend                                          | `countries.getByIdWithEconomicData` (via `CountryDataProvider`)                                                                                               |
| Land (map, capital, cities, regions, story pins, geo profile, neighbours) | `countryGeo.getCountryGeoBundle`; map embed `CountryMapEmbed` (+ the political layer from `/api/map-layers`)                                                  |
| Directives, issue outcomes                                                | `countries.getPublicRecord`; owner counts `intent.getTree` + `nationalIssues.getPendingCount` (owner only)                                                    |
| Government, parliament                                                    | `government.getByCountryId` (budget redacted for visitors), `elections.getElectionStatus`                                                                     |
| Country DNA, world                                                        | `mycountry.getRankings`, `diplomaticCore.getRelationships`, `diplomaticEmbassies.getEmbassies`                                                                |
| Chronicle                                                                 | Infobox establishment dates + story pins + directives + resolved issues + decisions and diplomatic events (`mycountry.getCanonFeed`), on the in-game calendar |
| Cover                                                                     | `unsplashService` (landscape), the flag, or a media-library image (`MediaSearchModal`)                                                                        |

## Architecture

```
countries/
├── page.tsx                          # Redirect to the realm's Nations tab
├── _components/economy/              # Economic modeling engine (the /modeling sandbox)
└── [slug]/
    ├── (profile)/
    │   ├── layout.tsx                # Country shell (CountryDataProvider, breadcrumb, ProfileShellProvider)
    │   ├── page.tsx                  # Factbook tab: CountryDocument
    │   ├── map/page.tsx              # Map tab: CountryDocument
    │   ├── lore/page.tsx             # Lore tab: CountryDocument
    │   ├── history/page.tsx          # History tab: CountryDocument
    │   └── activity/, dossier/, factbook/  # Old addresses: server redirects
    ├── modeling/page.tsx             # Economic scenario sandbox
    ├── _components/                  # CountryDocument, ProfileShellContext
    ├── _hooks/useCountryPageState.ts # Cover state (saved per country on the device)
    ├── _hooks/useCountryProfileLayer.ts # The profile's data layer
    ├── _types/                       # Domain types for profile pages
    └── _utils/profileLayer.ts        # Pure helpers: chronicle, founding dates, formatters (re-exports the public-record rules)
```

## Data sources (verified `api.*`)

| Procedure                                                                     | Used by                                                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `api.countries.getAll`                                                        | Explore list (`page.tsx`)                                                         |
| `api.countries.getByIdWithEconomicData`                                       | Profile shell (`CountryDataProvider`), modeling                                   |
| `api.countries.getPublicRecord`                                               | Profile: enacted directives and resolved issue outcomes (public, server-filtered) |
| `api.countries.getActivityRingsData`                                          | Telemetry vitality rings (via `CountryDataProvider`)                              |
| `api.activities.getCountryActivity`                                           | History tab (the feed)                                                            |
| `api.government.getByCountryId`                                               | State block and sheet (via the profile layer and `useMyCountryMetrics`)           |
| `api.wikios.getArticleHtml`                                                   | Lore tab (`LoreReader`)                                                           |
| `api.countryGeo.getCountryGeoBundle`, `GET /api/map-layers` (political layer) | Map embeds (via `useCountryMapEmbed`)                                             |
| `api.realms.region.contextClock` (via `useCountryClock`)                      | Time context: the country's realm clock and calendar (`CountryDataProvider`)      |
| `api.users.getProfile`, `api.countries.getByIdAtTime`                         | Viewer identity (`useUserCountry`)                                                |

All routers above are registered in `src/server/api/root.ts`.
