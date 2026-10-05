# Realms — Places

**Last updated:** 2026-10-05
**Routes:** `/realms` (directory) · `/r/[realm]` (realm page: Overview) · `/r/[realm]/board` · `/r/[realm]/nations` ·
`/r/[realm]/manage` · `/admin/realms`
**Code:** `src/server/api/routers/realms/` (`index.ts`, `places.ts`, `region.ts`), `src/server/modules/realms/`
(`realms.region.ts`, `realms.region-actions.ts`), `src/app/r/[realm]/(region)/`, `src/lib/realms/realm-region.ts`,
`src/server/api/routers/thinkpages/thinktanks/realm-board.ts`, `src/server/api/routers/thinkpages/realm-feed.ts`
**Product model and decisions:** [Realms framework spec](../architecture/realms-framework-spec.md) ·
[region page design](../specs/2026-10-05-realm-regions-design.md)

A realm is a world that nations live in (`Country.realmId`; IxWorld is `id: "default"`). The ownership,
claims, lore index and admin parts are described in the framework spec. This page covers realms as
**places**, the equivalent of a NationStates region: a directory to find them, a board where their nations
talk, a region page with its founder, officers, factbook, embassies and poll, and a feed that can be scoped to
one realm.

---

## 1. Realm directory (`/realms`)

`realms.directory` (public) lists the open realms:

- every realm with `visibility: "public"` and `status: "active"`;
- IxWorld (`DEFAULT_REALM_ID`), whatever its row says.

**Visibility and status rule (AT-6):**

| Realm | Listed (directory, its feed picker, embassy proposals) | Reachable by link (page, board, `?realm=`) |
| :---- | :---- | :---- |
| Public and active, or IxWorld | Yes | Yes |
| Unlisted and active | No | Yes |
| Archived | No | Yes, read-only and closed to claims |
| Draft or generating | No | Only its staff (founder, site admins) |

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

Each row also carries `bannerUrl`, `tags` and `foundedAt` (`Realm.foundedAt`, else `createdAt`). The page shows
each realm as a banner card with links to its page and board, and can be searched (name and description),
sorted (name, most nations, most active board, newest) and filtered by tag; only tags some realm uses are
offered. It shows "Join · claim a nation" (or "Claim another nation") while the viewer is under the realm's cap. The link goes to the realm page, where
claiming happens (`ClaimableNations`, `realms.claimNationPage`).

Signed-in players with claims see **Your claims** above the list (`realms.myClaims`, the `MyClaims` component): each
claim's nation and realm, its status (pending review, approved, rejected) and a rejection's reason.

Below the list, a **realm feed** panel shows the ThinkPages feed for one realm. It defaults to the realm of
the viewer's active nation (`useViewerRealmId`), or to **All realms** when signed out, and a selector
switches between realms and All realms.

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

| Who                                                      | Can                                                                  |
| :------------------------------------------------------- | :------------------------------------------------------------------- |
| Anyone (signed out included)                             | Read the board feed and the realm feed                               |
| Owners of a nation in the realm                          | Post as a persona of one of their nations there, chat, join or leave |
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

- a **muted** nation's owner can read and chat but not post (`createGroupPost` refuses with the reason);
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
description and tags, a key-stats strip (nations, population, founded, founder) and the tab bar: **Overview**,
**Board**, **Nations**, **Map** (opens `/maps?realm=`) and, for the founder and officers, **Manage**.
`realms.region.overview` serves the header and front page in one call; it hides draft and generating realms
from everyone but their staff, like `getBySlug` (§1, visibility rule).

**Overview:** the factbook (or the description), "Read the lore" to the realm's `Portal:` page, the latest five
board posts, and claimable nations. The sidebar (stacked under the main column below 1024px) has:

- **Officers:** the founder, or "Administered by IxStats staff" when `Realm.ownerId` is `"system"`, and each
  officer's title and nation;
- **World Census:** the realm's top five nations in one of ten categories (`achievements.getCountryLeaderboard`
  with `realm`), linking to `/leaderboards?realm=`;
- **Realm poll:** the one open poll (`Poll.realmId`); owners of a nation in the realm vote (`polls.vote` checks);
- **Embassies:** realms with an active embassy;
- **Happenings** (`realms.region.happenings`): new nations, approved claims, embassies opened, officers
  appointed and the realm's nations' public game events (`ActivityFeed`), newest first. Composed on read.

**Nations:** every nation, the viewer's first, with **Play as** and **Leave realm** on their own, then the viewer's
claims in this realm (`realms.myClaims({ realmSlug })`) and the claimable nations. A claimable nation the viewer
claimed shows **Pending review**, or the rejection's reason with **Claim again**.

**Claim notices (AT-5):** a rejected claim notifies its claimant (`notifyClaimRejected` in `realms.notices.ts`,
event `realmsNotification`): a moderator's rejection with its reason, an automatic one when another player took the
nation first, and rival pending claims turned away by an approval. It goes through `notificationAPI.create`, so the
recipient's preferences apply (`recipientAccepts`: the system category and minimum urgency). Approvals notify
through `onNationAssigned` ("Country Assigned"). Leaving
(`realms.region.abandonNation`) needs the nation's name typed; the nation is released (unclaimed), its board
restriction cleared, and the player loses an officer post if it was their last nation there.

### Governance

| Who | Powers |
| :-- | :----- |
| Founder (`Realm.ownerId`), and site admins | Everything below, plus claims review and appointing officers |
| Officer (`RealmOfficer`, custom title) | The powers the founder grants: `appearance` (factbook and header), `board` (moderation), `diplomacy` (embassies and the poll) |

`realmPowers` / `hasRealmPower` (`realms.access.ts`) decide; `requireRealmStaff` (`realms.region.ts`) gates every
Manage action and makes an archived realm read-only. Officers must own a nation in the realm (at most 12).
Site admins assign founders in `/admin/realms` (the Founder column, `realms.region.assignFounder`); until then a
realm is administered by staff.

**Deleting a realm (AT-8):** site admins delete a realm created by mistake from `/admin/realms`
(`realms.region.deleteRealm`, `realms.admin.ts`), confirmed by typing its slug. It refuses IxWorld, and any realm
that still has nations or map regions: deleting never releases, moves or deletes a nation, so such a realm is
archived instead (status Archived: read-only, closed to claims). An empty realm's claims, lore index, officers,
embassies, board restrictions and polls go with it, and its board group is deactivated.

### Manage tab (`/r/[realm]/manage`)

Sections follow the caller's powers: **Appearance** (banner and thumbnail as `https://` addresses
(`isRealmImageUrl`), description, up to five tags from `REALM_TAGS`), **Factbook** (the WikiOS canvas editor or wikitext; saved as wikitext plus rendered,
sanitized HTML), **Officers**, **Claims** (founder only; the admin claims list narrowed to the realm),
**Embassies** (propose to a directory realm; the other realm accepts or declines; either side closes; a
proposal crossing one from the other realm opens the embassy at once), **Poll** (one open at a time, 2 to 10
options, optional end date) and **Board moderation**.

## 5. Known gaps

- A member who leaves the board stays out until they press Join; their first visit is the only automatic join.
- Chat participants who lose their last nation are removed on the next time anyone opens the board, not the
  moment the nation changes hands.
- The `/dashboard` feed and trending are not realm-scoped. The realm feed is shown only on `/realms` and the board.
- A mute stops board posts, not chat messages.
- The banner is an image address; there is no upload.
- Happenings has no history page beyond the latest 15 items.

## 6. Map and transport isolation

- Transport routes and hubs take their owning country's `realmId` when created (AT-1). Rows created before this
  were all saved to IxWorld: run `bun run db:backfill-transport-realm` (dry run) and then with `-- --apply`. It is
  idempotent and leaves rows with no owning country where they are.
- The flag lookup by country name (`countries.flags.resolveBatch`) is scoped to the viewer's realm, or `?realm=` (AT-18).
- IxWorld's ocean labels and guided tour show only on IxWorld's map (AT-2).
- Map wiki lookups (`geoWiki.*`) use the wiki the realm's lore index was imported from (its `RealmPage.wikiSource`),
  and link to the in-site reader. IxWorld, and a realm with no lore index, keep ixwiki then iiwiki (AT-12).
