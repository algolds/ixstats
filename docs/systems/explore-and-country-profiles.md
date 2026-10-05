# Explore and Country Profiles

**Last updated:** 2026-10-05
**Status:** Live and public: signed-out visitors can browse every directory and profile.
**Routes:** `/countries` · `/explore` · `/explore/collections` · `/countries/[slug]` and its `factbook/**`, `dossier`,
`activity` and `modeling` sub-routes
**Code:** `src/app/countries/`, `src/app/explore/`, `src/components/country-profile/`,
`src/server/api/routers/countries/` (`list.ts`, `economy.ts`, `public-record.ts`), `src/lib/country/public-record.ts`
**Detailed route and component map:** [`src/app/countries/README.md`](../../src/app/countries/README.md)

Players find other nations in two country directories and read them on the country profile. This page covers what
each directory does, where profile data comes from, and what the server hides from visitors.

---

## 1. Directories

Both directories call `countries.getAll` (`cachedPublicProcedure`, realm-aware cache) with `limit: 1000` and filter in
the browser. `getAll` always excludes `isDemo` countries and is scoped to one realm (`realmWhere`):

- `?realm=<slug>` lists that realm;
- with no `realm`, it uses the realm of the viewer's active nation, or IxWorld when signed out;
- `realm: "*"` (`ALL_REALMS`) returns every realm for site admins; anyone else gets their own realm.

| | `/countries` | `/explore` |
| :--- | :--- | :--- |
| Page | `src/app/countries/page.tsx` → `CountriesPageModular` | `src/app/explore/page.tsx` |
| Sidebar entry | Realms → Countries | Realms → Explore |
| Realm | Reads `?realm=` and passes it on | Never passes `realm` (viewer's realm only) |
| Search | Name, tier, continent, region | Name, continent, region |
| Filters | Continent, economic tier | Economic tier, continent, region (once a continent is chosen), population range |
| Order | Shuffled with a per-visit seed | Sort by name, population, GDP per capita, total GDP, economic tier, continent, region, land area or population density, ascending or descending |
| Paging | All results | 9 per page |
| Compare | No | **Compare** opens `CountryComparisonModal` (up to 8 countries, `countries.getByIdAtTime`) |
| Header | Directory header | "Explore countries" with filtered population and combined GDP |

`/explore/collections` is a different thing: the public Vault card collection gallery (`CollectionGallery`,
`vault.getPublicCollections` and `vault.getCollectionLeaderboard`). It has search, sorting by newest, most valuable,
most cards or top rated, and a leaderboard.

## 2. The country profile

`/countries/[slug]` is one profile, the Command view (`CommandProfileView`), with the Factbook as the deep-dive. The
`(profile)/layout.tsx` shell loads the country through `CountryDataProvider` and shows the breadcrumb and the
**Country Actions** menu on every profile route. Tabs: Profile, Factbook (Overview, Economy, Labor, Government,
Geography), Dossier and Activity. `/countries/[slug]/modeling` is the economic modeling engine.

The README linked above lists every tile and its data source. In summary:

| Part | Source |
| :--- | :--- |
| Identity, vitals, economy | `countries.getByIdWithEconomicData` (`rateLimitedPublicProcedure`) |
| Enacted directives and resolved issues | `countries.getPublicRecord` (public) |
| Land, cities, regions, map | `countryGeo.getCountryGeoBundle`, `geoCore.getWorldMap` |
| Government and parliament | `government.getByCountryId`, `elections.getElectionStatus` |
| Rankings and relations | `mycountry.getRankings`, `diplomaticCore.getRelationships`, `diplomaticEmbassies.getEmbassies` |
| Lore | `wikios.getWikitext` (IxWiki), else `wikiCache.getCountryProfile` |
| Chronicle | Infobox dates, story pins, directives, resolved issues, `mycountry.getCanonFeed` |
| Activity tab | `activities.getCountryActivity` |

Missing data renders an empty state or drops the section; the profile shows no sample figures.

**Dossier.** `/countries/[slug]/dossier` renders `DossierTab`: wiki sections synced from the nation's article, plus a
**Native canvas lore** view. Native lore documents are written in the Canvas editor (`NativeLoreCanvasModal`, which
wraps `WikiVisualEditor`) or imported from `.md`, `.txt` or `.json` files. They are stored in the viewer's own
browser (`localStorage` key `ixstats_native_lore_<country name>`, `useNativeLore`) and never sent to the server.

## 3. Privacy: the public record

Visitors, signed in or not, see the public record only. The server enforces this; the client hides nothing that the
server sends.

- `countries.getPublicRecord` returns directives with status `active` or `completed` (never the `proposed` draft
  tier), and national issues with status `responded` or `auto_resolved`, with public fields only
  (`src/lib/country/public-record.ts`).
- `countries.getByIdWithEconomicData` drops the sector spending split (`governmentBudget`,
  `fiscalSystem.spendingByCategory`) unless the caller owns the nation or holds a privileged role.
- `government.getByCountryId` returns the structure to everyone, and budgets and revenue sources only to the owner
  and privileged roles.
- `intent.getTree`, `nationalIssues.getHistory` and the other owner-side procedures are owner/privileged only. The full
  list is in [MyCountry](./mycountry.md).

Tests: `src/tests/server/api/routers/country-public-record.test.ts` and `country-private-record.test.ts`.

When the viewer owns the country, an "Only you can see this" strip adds their open issues, drafts and in-force
directive counts from their own owner queries.

## 4. Procedures

| Procedure | Auth | Used by |
| :--- | :--- | :--- |
| `countries.getAll` | public (cached, realm-aware) | Both directories |
| `countries.getSelectList` | public | Compare picker on the profile |
| `countries.getByIdAtTime` | public | Explore compare modal, viewer identity |
| `countries.getByIdWithEconomicData` | public, rate limited | Profile shell, modeling |
| `countries.getPublicRecord` | public | Profile directives and issue outcomes |
| `countries.getActivityRingsData` | public, rate limited | Vitality rings |
| `vault.getPublicCollections`, `vault.getCollectionLeaderboard` | public | `/explore/collections` |

## 5. Jobs

None. Profiles read live data; country figures change through the economy jobs described in
[Economy](./economy.md).

## 6. Known gaps

- Two directories do overlapping work with different features. `/explore` cannot show another realm, and
  `/countries` cannot sort or compare.
- Native canvas lore lives in one browser only. It is not synced, other viewers never see it, and anyone can add
  documents to any country's dossier in their own browser. The Public / Alliance / Private clearance on a document is
  saved but not enforced: the profile always passes `viewerClearanceLevel="PUBLIC"`, and native documents are not
  filtered by it.
- The cover banner choice is saved per country on the owner's device only, so other viewers and other devices don't
  see it.

## Related documentation

- [Realms](./realms.md): realm scoping
- [MyCountry](./mycountry.md): the owner's side and the visibility list
- [WikiOS](./wikios.md): the Canvas editor
