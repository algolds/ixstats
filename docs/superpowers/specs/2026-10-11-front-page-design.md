# IxStates front page (signed-out `/`)

**Date:** 2026-10-11
**Status:** Design approved by the owner in chat (2026-10-11), spec awaiting review.
**Branch:** `feat/front-page`, cut from rose-garden.

Replaces the signed-out splash (`IxStatsSplashPage`) with a Facet front page for the platform. Signed-in visitors still get `DashboardRouter`.

## Owner decisions in force

- **Audience:** spectators. The page is a public window into the live platform; joining comes last.
- **Platform name:** IxStates. Ixnay is only ever "the Ixnay realm", one realm among several.
- **Framing:** IxStates is a worldbuilding platform; the simulation is one of its tools.
- **Frame:** the full shell (sidebar, Halo, canvas). The sidebar is the navigation; the page renders none of its own.
- **Tint:** Home ink canvas; each pane that previews an app sets that app's `data-app` (Maps cyan, Wiki navy, ThinkPages emerald, Realms purple). No borrowed tint for the page.
- **Header:** `EntityHeader` with IxStates as the entity.
- **Motion:** none for its own sake. Only live data changes; new rows fade in.
- **Layout:** front page. Header, then a lead row (map 8 cols, happenings 4 cols), an app row (Wiki, ThinkPages, Realms), the nations table, and one closing join pane.
- **Phones (<1024px):** one column in desktop order. The map stays live with cooperative gestures; the nations table becomes a ranked list.
- **Featured realm:** rotates daily (UTC), the same for everyone. The map, happenings and nations table follow it; the header and app row stay platform-wide.
- **Join:** one closing pane; primary action Create an account. No "Start a realm": players cannot create realms (admins create them and assign founders).
- **Players fact:** all registered accounts.
- **Approach:** client panes on existing public procedures, plus one new cached procedure for the realm-scoped and aggregate data. No server rendering for now.

## Starting point

- `src/app/page.tsx` renders `HomeClient`, which shows `IxStatsSplashPage` when signed out and `DashboardRouter` when signed in, deciding on the client with `useUser`.
- The old splash is 10 files in `src/app/_components/splash/` plus `src/lib/splash/mycountry-gold.ts`. It breaks Facet in several places (animated grid background, pulse dot, hand-rolled gold, hero block, eyebrows), and its stats never render: `isValidGlobalStats` checks `totalCountries` and `globalGrowthRate`, which `countries.getGlobalStats` does not return.
- `facet-guards.test.ts` and `facet-phase4-leftovers.test.ts` list the old splash paths as exemptions.
- Signed out, the sidebar lists Maps, Wiki, ThinkPages, Realms and Help, and its footer `AccountMenu` is the sign-in button.
- `EntityHeader` (`src/components/ui/entity-header.tsx`) takes `art`, `name`, `facts` and `action`; facts render as one `text-callout` line. Only a primitives test uses it.
- `CoordinatesMapEmbed` (`src/components/maps/widgets/CoordinatesMapEmbed.tsx`) draws a realm's whole political layer, lazy-loads when scrolled into view, and always places a red marker.
- `DIRECTORY_REALM_WHERE` (`src/server/shared/realm-directory.ts`) is the directory listing rule: Ixnay (`DEFAULT_REALM_ID = "default"`) plus public active realms.
- Public procedures used as-is: `realms.region.happenings({ slug })`, `wikios.getMainPage()`, `thinkpagesForum.latestActivity({ limit })`.
- Avoided: `nationalIssues.getRecentWorldIssues` writes to the database on every read; `crisisEvents.*` is empty in practice; `realms.directory` is uncached and rate-limited per client.

## 1. Page

`HomeClient` renders `<FrontPage />` when signed out, and sets the page title to "IxStates" (signed in stays "Dashboard"). The page root is `data-app` unset, so it wears the Home ink on the shell canvas.

All new UI lives in `src/app/_components/front-page/`: `FrontPage.tsx` (orchestration only) and one file per pane below.

### 1.1 Header

`EntityHeader`:

- `art`: the Ix mark (`src/app/_components/ix-logo-v2.svg`).
- `name`: "IxStates".
- `description` (new prop): "A worldbuilding platform. Build nations in shared realms, map them, write their history and run their economies."
- `facts`: "{realms} realms · {nations} nations · {players} players", figures in `tabular-nums`. Omitted while loading or on error.
- `action`: Button "Browse realms" → `/realms`.

### 1.2 Lead row: featured realm

**`FeaturedRealmMap`** (8 of 12 columns; Maps cyan; `content="visualization"`, flush pane):

- Title `{Realm name}` with a map icon; subtitle "Featured realm today".
- Trailing link "Open in IxWorld" → `/maps?realm={slug}`.
- Body: `CoordinatesMapEmbed` for the realm with `marker={false}`, a whole-world view, interactive. It mounts after `requestIdleCallback` (falling back to `setTimeout`), so MapLibre and tiles never compete with first paint. Until then the realm thumbnail fills the pane, or an empty Well when there is none.

**`RealmHappenings`** (4 columns; ink; `content="feed"`):

- Title "Happenings".
- Eight items from `realms.region.happenings({ slug, limit: 8 })`, relative IxTime timestamps, refetched every 60 s.
- Empty: "No happenings in {Realm} yet."

### 1.3 App row (three equal panes)

**`WikiPane`** (`data-app="wiki"`): title "Wiki". From `wikios.getMainPage()`: the featured article (image, title, two-line excerpt) linking to the article, then the first three `recentChanges` as a compact feed (title, editor, relative time). Trailing link to the wiki main page.

**`ForumPane`** (`data-app="thinkpages"`): title "ThinkPages". `thinkpagesForum.latestActivity({ limit: 5 })`: thread title, author with country flag (Facet exception 1), board name, relative time; each row links to `/thinkpages/t/{threadId}`. Refetched every 60 s. Trailing link to `/thinkpages`.

**`OpenRealmsPane`** (`data-app="realms"`): title "Realms with open nations". Up to four rows from `frontPage.get().openRealms`: thumbnail, name, "{n} open nations", linking to `/r/{slug}`. Empty: "No open nations right now." with a link to `/realms`.

### 1.4 Nations

**`RealmNations`** (ink; `content="data"`): title "Nations in {Realm}". Ten rows from `frontPage.get().nations`, ranked by total GDP:

| Column | Format |
|---|---|
| Flag and name | links to `/countries/{slug}` |
| Population | "48.2M" |
| GDP | "$1.2T" |
| GDP per capita | "$24,800" |
| Economic tier | `Badge` |
| Government | text, "–" when empty |

Figures right-aligned, `tabular-nums`. Footer link "See all {n} nations" → `/countries?realm={slug}`. Below 1024px the table becomes a `FacetList` ranked list (flag, name, GDP).

The table is not sortable: ten pre-ranked rows do not need it, and the full list is one link away.

### 1.5 Join

**`JoinPane`** (ink): title "Start your own". Line: "Found a nation in one of the realms above, or take over an open one."

- Primary: "Create an account" (Clerk `SignUpButton`, modal).
- Links: "Build a nation" → `/builder` (works without an account), "Sign in" (Clerk `SignInButton`, modal).

### 1.6 Grid and phones

- 12-column grid from 1024 px: lead row 8 + 4, app row 4 + 4 + 4, nations and join full width.
- Below 1024 px: one column in the same order.
- On coarse pointers the map uses MapLibre `cooperativeGestures`, so one-finger scrolling passes through to the page.

## 2. Data

### 2.1 `frontPage.get`

A new router `src/server/api/routers/frontPage.ts` (thin), registered in `root.ts`, with one `cachedPublicProcedure` (60 s), no input. Logic lives in `src/server/modules/front-page/front-page.service.ts`.

Returns:

```ts
{
  featured: { slug: string; name: string; thumbnail: string | null; nationCount: number };
  facts: { realms: number; nations: number; players: number };
  nations: Array<{
    slug: string; name: string; flagUrl: string | null;
    population: number; gdp: number; gdpPerCapita: number;
    economicTier: string | null; governmentType: string | null;
  }>; // top 10 by currentTotalGdp, sorted in the database
  openRealms: Array<{ slug: string; name: string; thumbnail: string | null; openNationCount: number }>; // top 4, open count > 0
}
```

- `facts.realms`: realms matching `DIRECTORY_REALM_WHERE`.
- `facts.nations`: all nations in those realms (the directory's `nationCount`, summed).
- `facts.players`: `user.count()`.
- `openRealms`: directory realms ranked by open nation count, descending, then name. Open means `ownerUserId: null`, the rule `realms.directory` uses for `openNationCount` (`routers/realms/places.ts`), counted with one `country.groupBy`.

### 2.2 Featured realm pick

Pure functions in `src/lib/front-page.ts`:

- `isFeaturable(realm)`: listed in the directory, has political `MapLayer` rows, and at least 3 nations.
- `pickFeaturedRealm(eligible, now)`: sort eligible realms by slug, return index `Math.floor(now / 86_400_000) % eligible.length`. With none eligible, the service returns Ixnay.

The pick changes at 00:00 UTC; the 60 s cache means it can lag by up to a minute.

### 2.3 Primitive changes

- `EntityHeader`: optional `description` rendered under the name in `text-body text-label-secondary`, 70ch max.
- `CoordinatesMapEmbed`: optional `marker` prop (default `true`, so existing wiki embeds are unchanged) and `cooperativeGestures` when `(pointer: coarse)` matches.

### 2.4 Deleted

- `src/app/_components/IxStatsSplashPage.tsx`
- `src/app/_components/splash/` (all 10 files)
- `src/lib/splash/`
- Their exemption entries in `src/tests/architecture/facet-guards.test.ts` and `facet-phase4-leftovers.test.ts`.

`InteractiveGridPattern` stays (`/feed` uses it).

## 3. States

Each pane loads and fails on its own.

- **Loading:** a skeleton Well shaped like the pane's content.
- **Empty:** the pane's own line (above), via `EmptyState`.
- **Error:** `EmptyState` "Couldn't load {thing}." with one Retry action that refetches that query.
- **`frontPage.get` fails:** the header keeps its name, description and action, without facts; the featured map, nations and open realms panes show their error state. Wiki and ThinkPages panes are unaffected.
- **Live updates:** happenings and forum refetch every 60 s. New rows fade in with CSS (`@starting-style`, `duration-fast`), disabled under Reduce Motion. Nothing else animates.

## 4. Copy

All UI strings follow Facet section 9: sentence case, no em dashes, "–" for empty values, units on every figure. The strings are the ones quoted above; no others are added.

## 5. Testing

- `src/lib/front-page.test.ts`: `isFeaturable` (map rows, nation threshold, directory rule) and `pickFeaturedRealm` (stable order, day rollover, wrap-around, single realm).
- `front-page.service` test with a mocked Prisma client: Ixnay fallback when no realm qualifies, nations sorted by GDP and capped at 10, open realms filtered and capped at 4.
- `FrontPage` render test with a mocked `api`: all panes render; one failing query shows only that pane's error.
- Facet guard tests pass with the exemptions removed.
- Gates: `bun run typecheck:ui`, `bun run typecheck:server`, `bun run test`, `bun run lint`. No builds.
- Browser check on the dev server, signed out, at 1440 px and 390 px: no console errors, the map mounts after first paint, every link resolves.

## Out of scope

- Server rendering of the front page (upgrade path if search traffic matters: prefetch in `page.tsx` with `HydrateClient`, which needs the signed-in/out decision moved to the server).
- Player-created realms (Atlas Release A gives founders world creation, not realm creation).
- Changes to the signed-in dashboard.
