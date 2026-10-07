# Realms — Places

**Last updated:** 2026-10-07
**Routes:** `/realms` (landing page and directory) · `/r/[realm]` (realm page: Overview) · `/r/[realm]/board` · `/r/[realm]/nations` ·
`/r/[realm]/manage` · `/r/[realm]/happenings` · `/admin/realms`
**Code:** `src/server/api/routers/realms/` (`index.ts`, `places.ts`, `region.ts`, `source-sync.ts`, `map.ts`), `src/server/modules/realms/`
(`realms.region.ts`, `realms.region-actions.ts`, `realms.transfer.ts`, `realms.source-sync.ts`, `realms.source-apply.ts`, `realms.map.ts`, `realms.map-access.ts`), `src/lib/realms/sources/`, `src/app/realms/`, `src/app/r/[realm]/(region)/`, `src/lib/realms/realm-region.ts`,
`src/server/api/routers/thinkpages/thinktanks/realm-board.ts`, `src/server/api/routers/thinkpages/realm-feed.ts`
**Product model and decisions:** [Realms framework spec](../architecture/realms-framework-spec.md) ·
[region page design](../specs/2026-10-05-realm-regions-design.md)

A realm is a world that nations live in (`Country.realmId`; IxWorld is `id: "default"`). The ownership,
claims, lore index and admin parts are described in the framework spec. This page covers realms as
**places**, the equivalent of a NationStates region: a directory to find them, a board where their nations
talk, a region page with its founder, officers, factbook, embassies and poll, and a feed that can be scoped to
one realm.

---

## 1. Realms landing page and directory (`/realms`)

`realms.directory` (public) lists the open realms:

- every realm with `visibility: "public"` and `status: "active"`;
- IxWorld (`DEFAULT_REALM_ID`), whatever its row says.

**Visibility and status rule (AT-6):**

| Realm                         | Listed (directory, its feed picker, embassy proposals) | Reachable by link (page, board, `?realm=`) |
| :---------------------------- | :----------------------------------------------------- | :----------------------------------------- |
| Public and active, or IxWorld | Yes                                                    | Yes                                        |
| Unlisted and active           | No                                                     | Yes                                        |
| Archived                      | No                                                     | Yes, read-only and closed to claims        |
| Draft or generating           | No                                                     | Only its staff (founder, site admins)      |

- Listing is `DIRECTORY_REALM_WHERE` in `places.ts`. Nothing else lists realms to other players.
- The builder's realm picker also offers an active unlisted realm to the player who founded it or holds a nation
  there (their own realm, not a listing).
- Draft and generating realms are hidden by `isRealmHiddenFrom` / `isRealmPublished` (`realms.access.ts`): the realm
  page and header (`getBySlug`, `region.overview`, happenings, Manage), its board (`realms.getBoard`), the
  `?realm=<slug>` scope of the countries directory, leaderboards and maps (`resolveViewerRealmId`, which falls back
  to IxWorld as for an unknown slug), and other realms' embassy panels.
- Claims (filing, and approving a pending one) need an active realm or IxWorld (`isRealmOpen`).
- The realm feed (`thinkpages.getFeed({ realmId })`) takes a realm id, which only the pages above hand out.

Each row reports only counted facts:

| Field               | Source                                                                                                                                                                                                    |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nationCount`       | Countries in the realm                                                                                                                                                                                    |
| `openNationCount`   | Countries in the realm with no owner (`ownerUserId: null`)                                                                                                                                                |
| `myNationCount`     | Countries in the realm the signed-in viewer owns (0 when signed out)                                                                                                                                      |
| `maxNationsPerUser` | The realm's nation cap (`Realm.settings`, default 1)                                                                                                                                                      |
| `board`             | `null` until someone first opens the board. Then `{ recentPosts, lastPostAt }`: board posts in the last `BOARD_ACTIVITY_WINDOW_DAYS` (7) days and the newest post's time, both from real-time `createdAt` |

| `openNationPageCount` | Nation pages of the realm's lore index that no country has taken yet (claimable, `realms.claimNationPage`; the same rule as the realm page's `nationPages`) |

Each row also carries `bannerUrl`, `tags` and `foundedAt` (`Realm.foundedAt`, else `createdAt`).

**Nation search.** `realms.searchNations({ query })` (public, `rateLimitedPublicProcedure`; query trimmed, 2 to 100
characters) finds nations whose name contains the query, case-insensitive, in the realms `DIRECTORY_REALM_WHERE`
lists only, so never in a draft, generating or unlisted realm. It returns at most `NATION_SEARCH_LIMIT` (20) rows,
sorted by name, each with its realm (`id`, `slug`, `name`) and `claimable`:

- `kind: "country"`: a non-demo country; claimable when nobody owns it. Owner ids are never returned.
- `kind: "page"`: a lore-index nation page no country has taken yet; always claimable.

### The landing page

`/realms` is the main page for exploring, searching and joining realms (`src/app/realms/page.tsx`, sections in
`src/app/realms/_components/`). Top to bottom, in the realm pages' gutter (`max-w-6xl`):

1. **Hero** (`RealmsHero`): what realms are, the totals (realms, nations, open to claim) and one call to action
   for the viewer. Signed out: **Sign in to play** and **Browse realms**. Signed in with no nation: **Join a
   realm** (to Open to join, else Browse). Holding nations: **Go to your realms** and **Join another realm**.
2. **Your realms** (signed in, `YourRealms`): each realm where the viewer holds nations (`realms.myNations`), with
   its banner and thumbnail from the directory row, "You hold N of cap", each nation with **Play as**
   (`PlayAsNation`; the active one reads Active) and links to the realm's board and Nations tab. Then **Your
   claims** (`realms.myClaims`, the `MyClaims` component): each claim's nation and realm, its status (pending
   review, approved, rejected) and a rejection's reason.
3. **Search** (`RealmSearch`): one box. Realms match on name, description or tag (client side, over the
   directory); nations come from `realms.searchNations` once two letters are typed, each showing its realm and a
   **Claimable** badge (to the realm's Nations tab) or **Claimed**.
4. **Open to join** (`OpenToJoin`): realms with `openNationCount + openNationPageCount > 0`, most open first, with
   the count of unclaimed nations and nation pages and a link to the realm's Nations tab, where claiming happens
   (`ClaimableNations`). It says so when the viewer already holds the realm's cap. Hidden when no realm is open.
5. **Browse all realms** (`BrowseRealms`): every listed realm as a banner card with links to its page and board,
   sorted (name, most nations, most active board, newest) and filtered by tag; only tags some realm uses are
   offered. A card shows "Join · claim a nation" (or "Claim another nation") while the viewer is under the
   realm's cap, linking to the realm's Nations tab.
6. **Realm feed** (`RealmFeedPanel`): the ThinkPages feed for one realm. It defaults to the realm of the viewer's
   active nation (`useViewerRealmId`), or to **All realms** when signed out, and a selector switches between
   realms and All realms.

## 2. Realm feed filter

`thinkpages.getFeed` takes an optional `realmId`. Without it the feed covers all realms and is unchanged.
With it, the feed shows (`realmFeedWhere`):

- public posts by personas whose country is in the realm (`account.country.realmId`);
- plus, once the realm has a board, the board's posts (`visibility: "thinktank"` posts tagged
  `"group:<boardId>"`).

It composes with the `countryId`, `hashtag` and `filter` inputs and is cached per realm (the cache key includes the realm id).

Where it is used: the `/realms` feed panel and the **Realm feed** tab of `/r/[realm]/board`. The
`/dashboard` feed (`activities.getGlobalFeed`) is not realm-scoped yet.

## 3. Realm board (`/r/[realm]/board`)

Each realm has one board: a ThinkTank of type `realm_board`, mapped by the `RealmBoard` model
(`prisma/schema/realm-boards.prisma`). It is created the first time anyone opens it (`realms.getBoard`); there
is no bulk migration. The full rules are in [ThinkTanks §4a](./thinktanks.md#4a-realm-boards-type-realm_board). In short:

| Who                                                       | Can                                                                                 |
| :-------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| Anyone (signed out included)                              | Read the board feed and the realm feed                                              |
| Owners of a nation in the realm                           | Post as a persona of one of their nations there, chat, join or leave                |
| Site admins, the founder, officers with the `board` power | Everything members can, plus remove posts (`removeGroupPost`), mute and ban nations |

`realms.getBoard({ slug })` returns:

- `groupId`;
- `realm`;
- `canPost`, `canModerate`;
- `ownedCountryIds`: the caller's nations in the realm, which the composer offers as personas.

Each call also syncs membership. It joins the caller on their first visit (a member row and a chat
participant), drops members who no longer own a nation there, and recounts `memberCount`.

The page has three tabs:

- **Board**: the ThinkTank feed, with a composer for members and a read-only notice for everyone else.
- **Chat**: the board's ThinkShare conversation, for members only.
- **Realm feed**: the realm-filtered ThinkPages feed.

The board is the **Board** tab of the realm page. Board moderation (section 4):

- a **muted** nation's owner can read but not post or chat: `createGroupPost` refuses with the reason, and so
  does `sendMessage` for the board's ThinkShare conversation (`realmBoardChatRestriction`, checked only for a
  ThinkTank chat whose group is a realm board);
- a **banned** nation's owner is not a board member (no posts, no chat): the ban deactivates their member row
  and chat participant at once (`removeFromRealmBoard`), and a ban on any one of a player's nations there
  counts;
- restrictions run for 1, 7 or 30 days or until lifted (`RealmBoardBan.until`), and the founder's and
  officers' nations can't be restricted. Nobody can remove a nation from the realm.

**Embassy posts:** a member can tick "Also show at our embassies". The post gets the pseudo-tag
`embassy:<realmId>`, and `getGroupFeed` on a partner realm's board includes it (labelled "From <realm>") while
the embassy is active: only `thinktank` posts that carry both the partner board's `group:` tag and its
`embassy:` tag (`groupFeedScope`). Moderators remove such posts on their own board only. Callers can't set
`group:` or `embassy:` tags themselves: `createGroupPost`, `createPost` and `updatePost` drop them
(`ownHashtags`), and editing a post's tags keeps the ones it has (`storedPseudoTags`).

## 4. Realm page (`/r/[realm]`)

The NationStates-style region page. Every tab shares a layout (`(region)/layout.tsx`): the banner, the name,
description and tags, a key-stats strip (nations, population, founded, founder, and the **in-world date** when
set) and the tab bar: **Overview**, **Board**, **Nations**, **Rules** (once the realm has rules; always for
`appearance` holders, with an empty state), **Map** (opens `/maps?realm=`) and, for the founder and officers,
**Manage**.
`realms.region.overview` serves the header and front page in one call; it hides draft and generating realms
from everyone but their staff, like `getBySlug` (§1, visibility rule).

**Overview:** the factbook (or the description), "Read the lore" to the realm's `Portal:` page, the latest five
board posts, and claimable nations. The sidebar (stacked under the main column below 1024px) has:

- **Community:** the realm's links (forum, Discord, wiki, map, website, other; `Realm.communityLinks`, at most 8,
  `https://` only), each with its kind's icon, opened in a new tab with `rel="noopener noreferrer nofollow"`.
  Hidden when there are none;
- **Officers:** the founder, or "Administered by IxStats staff" when `Realm.ownerId` is `"system"`, and each
  officer's title and nation;
- **World Census:** the realm's top five nations in one of ten categories (`achievements.getCountryLeaderboard`
  with `realm`), linking to `/leaderboards?realm=`;
- **Realm poll:** the one open poll (`Poll.realmId`); owners of a nation in the realm vote (`polls.vote` checks);
- **Embassies:** realms with an active embassy;
- **Happenings** (`realms.region.happenings`): new nations, approved claims, embassies opened, officers
  appointed and the realm's nations' public game events (`ActivityFeed`), newest first. Composed on read. The
  panel shows the latest 15 and links to **See all** (`/r/[realm]/happenings`): the whole history, filtered by
  kind (`kinds`) and loaded a page at a time (`cursor` is the previous page's `nextCursor`, the oldest time it
  showed; each source reads one more than the page to know whether more remain).

**Nations:** every nation, the viewer's first, with **Play as** and **Leave realm** on their own, then the viewer's
claims in this realm (`realms.myClaims({ realmSlug })`) and the claimable nations. A claimable nation the viewer
claimed shows **Pending review**, or the rejection's reason with **Claim again**.

**Rules (`/r/[realm]/rules`):** the founder's rules (`Realm.rulesWikitext`, rendered and sanitized into `rulesHtml`
on save like the factbook). While a realm has rules, the claim list shows their opening lines, **Read the rules**
and an **I have read the realm's rules** checkbox, and Claim stays disabled until it is ticked. The server enforces
it: `realms.claimNationPage` and `realms.claimCountry` take `acceptedRules` and refuse with `PRECONDITION_FAILED`
(`RULES_NOT_ACCEPTED`) when the realm has rules and it is missing; the filed claim records `rulesAcceptedAt`.
(`/setup` claims IxWorld nations and shows that error if IxWorld ever gets rules.)

**In-world date:** a display label in the stats strip (`Realm.settings.inWorldDate`, `realmInWorldDate` /
`withInWorldDate` in `realms.settings.ts`, formatted by `formatInWorldDate` in `src/lib/realms/realm-community.ts`):
either a fixed label ("14 Harvest 1203 AE", optionally "as of" a real date) or real year + offset with an era
("2041 AE"). The simulation and every date elsewhere keep the shared IxTime clock; the country page shows no current
IxTime date, so it shows no in-world date either.

**Claimed nation pages prefill their nation (AT-3):** approving a claim on a nation page (by a moderator, or at
once for the page's verified creator) first reads the page's infobox (`fetchNationPagePrefill` in
`realms.prefill.ts`, the builder's wiki import parser `parseInfoboxWithTemplates`), then creates the Country with
its population, GDP per capita, area, continent, government, flag and coat of arms instead of the placeholder
baseline, and a NationalIdentity (official name, capital, largest city, motto, currency, languages, demonym,
anthem, religion). MyCountry and the builder's editor open on those values. Implausible figures are dropped; an
unreachable page (8 second limit) or a page without an infobox gives the plain baseline. The builder refuses to
found a nation named after one of the realm's nation pages (`countries.createCountry`): those are claimed.

**Claim notices (AT-5):** a rejected claim notifies its claimant (`notifyClaimRejected` in `realms.notices.ts`,
event `realmsNotification`): a moderator's rejection with its reason, an automatic one when another player took the
nation first, and rival pending claims turned away by an approval. It goes through `notificationAPI.create`, so the
recipient's preferences apply (`recipientAccepts`: the system category and minimum urgency). Approvals notify
through `onNationAssigned` ("Country Assigned"). Leaving
(`realms.region.abandonNation`) needs the nation's name typed; the nation is released (unclaimed), its board
restriction cleared, and the player loses an officer post if it was their last nation there.

### Governance

| Who                                        | Powers                                                                                                                                                                                         |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Founder (`Realm.ownerId`), and site admins | Everything below, plus appointing officers; the founder alone hands the realm over from Manage                                                                                                 |
| Officer (`RealmOfficer`, custom title)     | The powers the founder grants: `appearance` (factbook, header, rules, links, in-world date), `board` (moderation), `diplomacy` (embassies and the poll), `claims` (review the realm's claims), `map` (edit the realm's map, borders and labels, and import maps; see below) |

`realmPowers` / `hasRealmPower` (`realms.access.ts`) decide; `requireRealmStaff` (`realms.region.ts`) gates every
Manage action and makes an archived realm read-only. Officers must own a nation in the realm (at most 12).

**Map editors:** `canEditRealmMap` / `canImportRealmMap` (`realms.access.ts`) allow site admins, the founder and
officers holding `map`, in their own realm only; IxWorld's map stays with site admins, and an archived realm's map is
read-only (`realmMapAccess`, `realms.map-access.ts`). The world editor's procedures (border edit, split and merge,
region links, linkage validation and Auto-Match, realm labels) resolve the edited realm through `editableMapRealmId`
(`src/server/api/trpc/realm-scope.ts`) and refuse any other realm with `FORBIDDEN`. Founders and map officers open the
world editor from **World editor** on `/maps?realm=<slug>`. A map officer renames a region, not the nation linked to
it; creating a nation from a shape stays with site admins. See [maps.md](maps.md#realm-maps).

**Claims reviewers:** `realms.reviewClaim` accepts site admins, the founder, and officers holding `claims` in the
claim's realm (only the reviewer's own `RealmOfficer` row is read); `realms.listClaims` lists the realms the caller
founds or reviews for. An officer can't approve their own claim (they may still reject it); the founder and site
admins can.

**Handing a realm over** (`realms.transfer.ts`): site admins transfer any realm in `/admin/realms` (the Transfer
action, `realms.region.adminTransferOwner`) to an active account picked from the user list (by nation or Clerk id),
or back to IxStats staff; IxWorld stays with staff. The founder hands their own realm to a player who owns a nation
in it or is one of its officers (Manage → **Hand over**, `realms.region.handOver`, candidates from
`handOverCandidates`). Both need the realm's slug typed (checked on the server), write an `AdminAuditLog` row
(`REALM_OWNER_TRANSFERRED`, `changes` holding `previousOwnerId`, `newOwnerId`, `keptPreviousAsOfficer` and `via`),
drop the new founder's officer post, and notify the new founder (and a previous founder staff replaced). The
previous founder loses the founder's powers unless **Keep previous owner as officer** is ticked: they stay on as a
"Former founder" officer holding every power. Until a realm is handed to a player it is administered by staff.

**Deleting a realm (AT-8):** site admins delete a realm created by mistake from `/admin/realms`
(`realms.region.deleteRealm`, `realms.admin.ts`), confirmed by typing its slug. It refuses IxWorld, and any realm
that still has nations or map regions: deleting never releases, moves or deletes a nation, so such a realm is
archived instead (status Archived: read-only, closed to claims). An empty realm's claims, lore index, officers,
embassies, board restrictions and polls go with it, and its board group is deactivated.

### Manage tab (`/r/[realm]/manage`)

Sections follow the caller's powers: **Appearance** (banner and thumbnail, each uploaded or given as an `https://`
address; description; up to five tags from `REALM_TAGS`), **Links** (community links), **In-world date**,
**Factbook** (the WikiOS canvas editor or wikitext; saved as wikitext plus rendered, sanitized HTML), **Rules**
(the same editor; empty text removes the rules), **Officers** (each power with a one-line description), **Claims**
(the founder and officers holding `claims`; the admin claims list narrowed to the realm, with Approve disabled on an
officer's own claim),
**Embassies** (propose to a directory realm; the other realm accepts or declines; either side closes; a
proposal crossing one from the other realm opens the embassy at once), **Poll** (one open at a time, 2 to 10
options, optional end date), **Board moderation**, **Map** (holders of `map`: planet radius, base image, credit
line, clearing the default view, and **Recompute areas**, whose "Also set nations' land area from the map" box only
the founder sees; see [maps.md](maps.md#realm-maps)), **Source sync** (founder only; see below) and **Hand over** (the
founder only, `manage.canHandOver`).

**Banner and thumbnail uploads:** the Appearance fields upload through the site's image upload route
(`/api/upload/image` via `uploadImageFile`: signed in, rate limited, PNG/JPG/GIF/WEBP/SVG only, 5MB, SVG
sanitized), the same path flags and coats of arms use, and keep the address field as an alternative.
`updateAppearance` accepts only an `https://` address or a file that route produced (`/images/uploads/uploaded_…`,
`isRealmImageUrl`); pages render either through `assetUrl`.

### Source sync

A realm's nations, figures, borders and alliances can follow an outside source (`RealmSourceSync`, one per realm):
a public GitHub repository read through a source adapter (`src/lib/realms/sources/adapters`; today the
`eurth-map` layout: a JavaScript nation table, an organisation list and GeoJSON borders, read with a literal-only
reader, never evaluated). Every value (repository, ref, file paths, field names, wiki link prefixes, alliance type
rules, attribution, options, a free-text continent table) is the realm's own; presets
(`src/lib/realms/sources/presets`) only fill them. Site admins (`/admin/realms` → Source sync) and the founder
(Manage → Source sync) configure it, dry-run it (the diff, with per-entry decisions: match by hand, exclude, pin a
field, alliance type), apply it and see the run history (`RealmSyncRun`); the `realm-source-sync` cron job runs
realms whose schedule is due. New nations are created **unclaimed** (`ownerUserId` empty, shown as **Unclaimed**
with **Claim** on the realm's Nations tab, the map panel and the country page); a claim hands the existing nation
over. A sync never deletes a nation, never removes an alliance member and never changes a claimed nation's owner.
Borders go through `src/lib/maps/realm-map-writer.ts`. Runbook: [realms-eurth-onboarding.md](realms-eurth-onboarding.md) step 4.

Alliances are realm-scoped (`Alliance.realmId`): names are unique per realm, and only nations of the alliance's
realm can be invited to or join it.

## 5. Known gaps

- A member who leaves the board stays out until they press Join; their first visit is the only automatic join.
- Chat participants who lose their last nation are removed on the next time anyone opens the board, not the
  moment the nation changes hands.
- The `/dashboard` feed and trending are not realm-scoped. The realm feed is shown only on `/realms` and the board.

## 6. Map and transport isolation

- Transport routes and hubs take their owning country's `realmId` when created (AT-1). Rows created before this
  were all saved to IxWorld: run `bun run db:backfill-transport-realm` (dry run) and then with `-- --apply`. It is
  idempotent and leaves rows with no owning country where they are.
- The flag lookup by country name (`countries.flags.resolveBatch`) is scoped to the viewer's realm, or `?realm=` (AT-18).
- IxWorld's ocean labels and guided tour show only on IxWorld's map (AT-2).
- Map wiki lookups (`geoWiki.*`) use the wiki the realm's lore index was imported from (its `RealmPage.wikiSource`),
  and link to the in-site reader. IxWorld, and a realm with no lore index, keep ixwiki then iiwiki (AT-12).
- A coordinates embed in a wiki article shows IxWorld's map in an IxWiki article; in another wiki's article, the map
  of the realm whose lore index holds the article, else of the only realm whose lore comes from that wiki
  (`realms.map.realmForWikiArticle`); otherwise the viewer's realm.
