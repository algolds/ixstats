# Realms — Places

**Last updated:** 2026-09-30
**Routes:** `/realms` (directory) · `/r/[realm]` (realm page) · `/r/[realm]/board` (realm board) · `/admin/realms`
**Code:** `src/server/api/routers/realms/` (`index.ts`, `places.ts`), `src/server/modules/realms/`,
`src/server/api/routers/thinkpages/thinktanks/realm-board.ts`, `src/server/api/routers/thinkpages/realm-feed.ts`
**Product model and decisions:** [Realms framework spec](../architecture/realms-framework-spec.md)

A realm is a world that nations live in (`Country.realmId`; IxWorld is `id: "default"`). The ownership,
claims, lore index and admin parts are described in the framework spec. This page covers realms as
**places**, the equivalent of a NationStates region: a directory to find them, a board where their nations
talk, and a feed that can be scoped to one realm.

---

## 1. Realm directory (`/realms`)

`realms.directory` (public) lists the open realms:

- every realm with `visibility: "public"` and `status: "active"`;
- IxWorld (`DEFAULT_REALM_ID`), whatever its row says.

Unlisted realms stay readable by link only (`/r/[realm]`). The rule is `DIRECTORY_REALM_WHERE` in `places.ts`.

Each row reports only counted facts:

| Field               | Source                                                                                                                                                                                                    |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nationCount`       | Countries in the realm                                                                                                                                                                                    |
| `openNationCount`   | Countries in the realm with no owner (`ownerUserId: null`)                                                                                                                                                |
| `myNationCount`     | Countries in the realm the signed-in viewer owns (0 when signed out)                                                                                                                                      |
| `maxNationsPerUser` | The realm's nation cap (`Realm.settings`, default 1)                                                                                                                                                      |
| `board`             | `null` until someone first opens the board. Then `{ recentPosts, lastPostAt }`: board posts in the last `BOARD_ACTIVITY_WINDOW_DAYS` (7) days and the newest post's time, both from real-time `createdAt` |

The page shows each realm with links to its page and board. It shows "Join · claim a nation" (or "Claim
another nation") while the viewer is under the realm's cap. The link goes to the realm page, where
claiming happens (`ClaimableNations`, `realms.claimNationPage`).

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
| Site admins and the realm's founder (`canModerateRealm`) | Everything members can, plus remove posts (`removeGroupPost`)        |

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

The realm page (`/r/[realm]`) links to the board.

## 4. Known gaps

- A member who leaves the board stays out until they press Join; their first visit is the only automatic join.
- Chat participants who lose their last nation are removed on the next time anyone opens the board, not the
  moment the nation changes hands.
- The `/dashboard` feed and trending are not realm-scoped. The realm feed is shown only on `/realms` and the board.
- There is no navigation entry for `/realms` yet.
