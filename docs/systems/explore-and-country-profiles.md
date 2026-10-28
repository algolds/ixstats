# Explore and Country Profiles

**Last updated:** 2026-10-25
**Status:** Live and public: signed-out visitors can browse every directory and profile.
**Routes:** `/countries` · `/countries/[slug]` and its `factbook/**`, `dossier`,
`activity` and `modeling` sub-routes
**Code:** `src/app/countries/`, `src/components/country-profile/`,
`src/server/api/routers/countries/` (`list.ts`, `economy.ts`, `public-record.ts`), `src/lib/country/public-record.ts`;
native lore: `src/server/api/routers/countryLore.ts`, `src/server/modules/lore/`, `src/components/country-profile/lore/`
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
| Lore | `wikios.getArticleHtml` (the article and each lore piece), `countryLore.list` (the pieces) |
| Chronicle | Infobox dates, story pins, directives, resolved issues, `mycountry.getCanonFeed` |
| History tab (feed) | `activities.getCountryActivity` |

Missing data renders an empty state or drops the section; the profile shows no sample figures.

**Lore.** `/countries/[slug]/lore` (formerly Dossier) shows the nation's wiki article as WikiOS renders it
(`wikios.getArticleHtml`), without its infobox, beside WikiOS's contents, and then the country's native lore pieces
(below). The old browser-only native lore (saved in each viewer's localStorage) was removed on 2026-10-24.

### Native lore

Spec: [`2026-10-24-native-lore-design.md`](../specs/2026-10-24-native-lore-design.md). A lore piece is an
ordinary wiki page about the country: a person, place, event or organisation. It has wikitext, history and a talk page
like any page, and it is mirrored to classic MediaWiki like any page. IxStates keeps only who may write lore and how the
owner arranges the pieces.

**Who sees what.** Native lore is for countries in the default (IxWiki) realm. Reading is always on there: the Lore tab
lists the pieces whether or not WikiOS takes edits, so pages already in `Category:<Country> lore` show as soon as this
is deployed. Writing (the entry points, curation and the lore team) is on only while WikiOS editing is on
(`WIKIOS_V1_ENABLED` or the admin editing switch, `src/lib/wiki-os/editing-switch.ts`). `countryLore.access` answers
`{ enabled, isOwner, canWrite }` for writing, and the page offers nothing it would refuse:

| Viewer | Gets |
| :--- | :--- |
| Visitor | The pieces as chapters, and Open in WikiOS on each |
| Co-author (the lore team) | Also Write lore on the Lore tab, Edit on each piece, the Map tab's write bar and the History pencil |
| Owner | Also Pin or Unpin, Hide, Add an existing page, and the lore team on the back face (Manage) |

"Owner" means `hasCountryWriteAccess`: the nation's owner, the player acting as it, and privileged roles. Admins and
staff (`isPrivilegedCountryWriter`) therefore count as owners on every country, for the lore team and the curation alike.
Every write is checked again on the server (`requireLore` in `lore.service.ts`). The wiki itself stays open: anyone with
wiki rights can edit a piece there.

**Writing.** The writer (`LoreWriter`) is a full-screen dialog on the country page. The author picks a type, names the
piece (the title is checked live against existing pages) and fills a short infobox form; the WikiOS visual editor then
opens on the page with the generated infobox (`Infobox person`, `Infobox settlement`, `Infobox event` or
`Infobox organization`), the type's section headings and two categories: `[[Category:<Country> lore]]` and
`[[Category:<Country>]]`. The save goes through WikiOS's normal save path under the author's own name, then
`countryLore.recordPiece` stores the piece's type. Entry points:

- **Write lore** on the Lore tab.
- **Write about this place** on the Map tab, after choosing a region, city or story: the title, the type Place and the
  location are filled in.
- **Write about this event** (the pencil) on a History entry: the title, the type Event and the date are filled in.

A page is recorded only while it carries `[[Category:<Country> lore]]`. If an author removes that line before saving,
the writer says so and offers to reopen the page to put it back. For a title that already exists, the owner can add that
page to the Lore tab instead, and a co-author can open it.

**The Lore tab.** `countryLore.list` merges the pages of `Category:<Country> lore` with the pages the owner added by title,
drops hidden and deleted ones, and orders pinned pieces first. A recorded piece stays listed only while its page is in
the category; only a page the owner added (`ownerAdded`) lists without it, so a co-author cannot keep an arbitrary page on
the tab by recording it and then taking the category off. A co-author's record never changes the type of a piece that
already has one: the owner's type stands. Pieces are grouped as People, Places, Events, Organisations and Other
(the type comes from the curation record, else from the page's infobox). Each piece is a chapter after the article, read
inline from `wikios.getArticleHtml` once it nears the viewport. Its ids are scoped to the chapter, so a footnote or a
contents link lands inside that piece, and its headings sit below the piece's title. The index beside the article lists
the article's contents and then the pieces. A piece that fails to load says so in its own chapter; the others still
render.

**Curation (owner).** Pin and Unpin put a piece first in its group. Hide takes a piece off the Lore tab without touching
the wiki; Add an existing page brings it back, or adds any other page by title. Nothing here edits a wiki page.

**The lore team (owner).** On the back face (Manage), the owner adds co-authors by IxnayID handle and removes them. A
removed co-author loses the entry points on their next page load. A page they already have open keeps its buttons until
then, but the server refuses their lore records at once; on the wiki they stay ordinary editors, like anyone.

**Records.** `country_lore_authors` (country, user, who added them, when) and `country_lore_pages` (country, title,
type, pinned, hidden, owner-added), both deleted with their country. Migration:
`prisma/migrations/20261104120000_country_lore/migration.sql` ([runbook](#native-lore-deploy-runbook-owner)).

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
| `countryLore.access` | public | Lore entry points, the writer |
| `countryLore.list` | public, read-only | Lore tab pieces |
| `countryLore.recordPiece` | owner or co-author, rate limited | The writer, after a save |
| `countryLore.setCuration`, `countryLore.addExisting` | owner, rate limited | Pin, Hide, Add an existing page |
| `countryLore.team`, `countryLore.addAuthor`, `countryLore.removeAuthor` | owner | The lore team on the back face |

## 5. Jobs

None. Profiles read live data; country figures change through the economy jobs described in
[Economy](./economy.md).

## 6. Known gaps

- The cover banner choice is saved per country on the owner's device only, so other viewers and other devices don't
  see it.
- Native lore waits for WikiOS editing in production. Until WikiOS v1 launches there, the entry points and the lore
  team stay hidden; the Lore tab still lists any page already in a country's lore category.
- The Lore tab reads at most 500 pages of a country's lore category.

## Native lore deploy runbook (owner)

Production and the `ixstats` database are touched only here, by the owner, in this order. The read-only checks run with
`docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`.

1. **Back up.** `scripts/deploy-production.sh` runs `bun run db:backup` before any SQL and stops if the dump fails.
2. **Apply the SQL before the push.** `scripts/deploy-production.sh` applies
   `prisma/migrations/20261104120000_country_lore/migration.sql` after the IxnayID SQL and before `db:push:force`. It is
   one transaction, additive, and a no-op when run again. To apply it by hand:
   `docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < prisma/migrations/20261104120000_country_lore/migration.sql`.
3. **Check.** `SELECT to_regclass('country_lore_authors'), to_regclass('country_lore_pages');` names both tables.
4. **Editing.** Native lore follows WikiOS editing and needs no switch of its own. It appears for owners once WikiOS v1
   launches in production ([cutover steps](../history/operations/wikios-v1-cutover.md)).
5. **Tell owners.** A lore page needs `[[Category:<Country> lore]]` to be listed and recorded (the writer adds it), and a
   co-author who is removed loses access on their next page load.

## Related documentation

- [Realms](./realms.md): realm scoping
- [MyCountry](./mycountry.md): the owner's side and the visibility list
- [WikiOS](./wikios/WIKIOS.md): the Canvas editor
