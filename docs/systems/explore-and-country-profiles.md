# Explore and Country Profiles

**Last updated:** 2026-10-17
**Status:** Live and public: signed-out visitors can browse every directory and profile.
**Routes:** `/countries` · `/countries/[slug]` and its `factbook/**`, `dossier`,
`activity` and `modeling` sub-routes
**Code:** `src/app/countries/`, `src/components/country-profile/`,
`src/server/api/routers/countries/` (`list.ts`, `economy.ts`, `public-record.ts`), `src/lib/country/public-record.ts`
**Detailed route and component map:** [`src/app/countries/README.md`](../../src/app/countries/README.md)

Players find other nations in their realm's directory and read them on the country profile. This page covers the
directory, where profile data comes from, and what the server hides from visitors.

---

## 1. Directories

The nation directory is each realm's **Nations** tab (`/r/<realm>/nations`, `src/app/r/[realm]/(region)/nations/`).
`/countries` redirects there (`src/app/countries/page.tsx`): `?realm=<slug>` to that realm's, otherwise to the viewer's
active nation's realm, or Ixnay when signed out or without a nation. The Nations tab calls `countries.getAll`
(`cachedPublicProcedure`, realm-aware cache) and filters in the browser. `getAll` always excludes `isDemo` countries
and is scoped to one realm (`realmWhere`):

- `?realm=<slug>` lists that realm;
- with no `realm`, it uses the realm of the viewer's active nation, or Ixnay when signed out;
- `realm: "*"` (`ALL_REALMS`) returns every realm for site admins; anyone else gets their own realm.

The public Vault card collection gallery is gone: players' showcases live in the cards hub's Sets tab
([cards.md](./cards.md#showcases)), and its old address redirects there.

## 2. The country profile

`/countries/[slug]` is **one document, like the passport**: a face (the live map, identity, the dashboard's figures
and the Country DNA row), the shared ribbon and one panel (`CountryDocument`). The ribbon's four tabs each have
their own URL and switch in place: **Factbook** (`/countries/[slug]`: three snapshot blocks, Economy & people, State
and Foreign affairs, each opening its full detail in a sheet, `?sheet=`), **Map** (`/map`), **Lore** (`/lore`: the
wiki article as one reading column) and **History** (`/history`: chronicle and feed as one timeline). Visitors get
**Country actions** on the face; the owner's **Manage** turns the face over to the cover choice, the owner strip
and the editor. `(profile)/layout.tsx` loads the country through `CountryDataProvider` and shows the breadcrumb.
The old `/activity`, `/dossier` and `/factbook/<section>` addresses redirect. `/countries/[slug]/modeling` is the
economic scenario sandbox, linked from the Economy & people sheet.

The README linked above lists every tile and its data source. In summary:

| Part | Source |
| :--- | :--- |
| Identity, vitals, economy | `countries.getByIdWithEconomicData` (`rateLimitedPublicProcedure`) |
| Enacted directives and resolved issues | `countries.getPublicRecord` (public) |
| Land, cities, regions, map | `countryGeo.getCountryGeoBundle`; the map embed draws the political layer from `GET /api/map-layers` |
| Government and parliament | `government.getByCountryId`, `elections.getElectionStatus` |
| Rankings and relations | `mycountry.getRankings`, `diplomaticCore.getRelationships`, `diplomaticEmbassies.getEmbassies` |
| Lore | `wikios.getWikitext` (IxWiki), else `wikiCache.getCountryProfile` |
| Chronicle | Infobox dates, story pins, directives, resolved issues, `mycountry.getCanonFeed` |
| History tab (feed) | `activities.getCountryActivity` |

Missing data renders an empty state or drops the section; the profile shows no sample figures.

**Lore.** `/countries/[slug]/lore` (formerly Dossier) reads the nation's wiki article (`useDossier`): the
prologue as a lead, then every chapter in order, with a chapter index. The old browser-only native lore (saved in
each viewer's localStorage) was removed on 2026-10-24; native lore returns as real WikiOS pages
(`docs/superpowers/specs/2026-10-24-native-lore-design.md`).

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

## 5. Jobs

None. Profiles read live data; country figures change through the economy jobs described in
[Economy](./economy.md).

## 6. Known gaps

- Native canvas lore lives in one browser only. It is not synced, other viewers never see it, and anyone can add
  documents to any country's dossier in their own browser. The Public / Alliance / Private clearance on a document is
  saved but not enforced: the profile always passes `viewerClearanceLevel="PUBLIC"`, and native documents are not
  filtered by it.
- The cover banner choice is saved per country on the owner's device only, so other viewers and other devices don't
  see it.

## Related documentation

- [Realms](./realms.md): realm scoping
- [MyCountry](./mycountry.md): the owner's side and the visibility list
- [WikiOS](./wikios/WIKIOS.md): the Canvas editor
