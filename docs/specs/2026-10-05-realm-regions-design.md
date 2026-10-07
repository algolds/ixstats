# Realms as NationStates-style regions — design

**Last updated:** 2026-10-07 · **Status:** built on `rose-garden` (2026-10-05); ownership transfer and the `claims`
officer power added 2026-10-07 (see [Amendments](#amendments-2026-10-07)); see [realms.md §4](../systems/realms.md#4-realm-page-rrealm)

Turns `/r/[realm]` into a NationStates-style region page. Decisions below were made by the owner on 2026-10-05; the
current-state audit is summarised at the end. Related: [realms.md](../systems/realms.md),
[realms-framework-spec.md](../architecture/realms-framework-spec.md).

## Decisions

| Topic | Decision |
|---|---|
| Page structure | **Hybrid:** an NS-style front page plus tabs — Overview · Board · Nations · Map (Happenings and Lore stay reachable from Overview) · **Manage** (founder and officers only) |
| Header | **Banner image** across the top and a **key-stats strip** (nations, population, founded, founder). No separate flag or motto field |
| Factbook | **Written in-app** by the founder or officers with the WikiOS canvas editor; the `Portal:<Realm>` wiki link stays as "Read the lore" |
| Governance | **Founder + officers.** Officers have a custom title and a chosen set of powers. No delegate or endorsements |
| Officer powers | Grantable: **edit factbook & header**, **moderate the board**, **embassies & polls**, **review claims** (added 2026-10-07). Founder-only: appoint officers, hand the realm over |
| Embassies | **Yes, with cross-posting:** one realm proposes, the other accepts; listed in the sidebar; board posts flagged for embassies show on the partner realm's board |
| Removing nations | **Board mute/ban only.** Founders and officers can stop a nation posting on the board; they cannot take a nation out of the realm |
| Sidebar | Officers, **census panel** (the 10 realm-scoped World Census categories, switchable), **realm poll** (one active poll), **happenings** (game events: new nations, claims approved, elections, treaties) |
| Manage UI | A **Manage tab**: Appearance (banner), Factbook, Officers, Claims (founder and `claims` officers), Embassies, Polls, Board moderation, Hand over (founder) |
| Founders of existing realms | **Site admins transfer** realms in `/admin/realms` (typed slug, audited); until then the realm shows "Administered by IxStats staff" and site admins act as founder. A founder can hand their realm on themselves |
| Directory (`/realms`) | **Tags** (fixed list chosen by founders), **search and sort** (name; nations, activity, newest), **banner cards** |
| Leaving | **Players can abandon a nation:** a confirmed "Leave realm" releases it (it becomes unclaimed) |

## Front page (Overview)

```
┌──────────────────────── banner ────────────────────────┐
│ Realm Name                                              │
│ 42 nations · 1.2 bn people · founded 2026 · Founder: X  │
│ Overview | Board | Nations | Map | Manage*              │
├──────────────────────────────────┬─────────────────────┤
│ Factbook (rich text)             │ Officers            │
│ Read the lore →                  │ Census [category ▾] │
│ Latest board posts (5) [compose] │ Poll                │
│ → full board                     │ Embassies           │
│                                  │ Happenings          │
└──────────────────────────────────┴─────────────────────┘
* founder and officers only
```

On phones (below 1024px) the sidebar panels stack under the main column in the order above.

## Data model (additive)

- `Realm`: `bannerUrl`, `factbookWikitext` and `factbookHtml` (sanitized), `factbookUpdatedAt`, `factbookUpdatedBy`,
  `tags String[]`, `foundedAt` (nullable; null shows `createdAt`). `ownerId` stays the founder (`"system"` =
  staff-administered).
- `RealmOfficer`: `realmId`, `userId` (Clerk id), `title`, `powers String[]` (`appearance`, `board`, `diplomacy`,
  `claims`),
  `appointedBy`, timestamps; unique `(realmId, userId)`.
- `RealmEmbassy`: `fromRealmId`, `toRealmId`, `pairKey` (unique pair), `status` (`proposed` / `active` /
  `closed`), `proposedBy`, `respondedBy`, `openedAt`, `closedAt`.
- `RealmBoardBan`: `realmId`, `countryId`, `kind` (`mute` / `ban`), `reason`, `until?`, `createdBy`.
- Polls: reuse `Poll` with a nullable `realmId` (one active per realm).
- Board posts: an `embassy:<realmId>` pseudo-hashtag on realm-board posts for cross-posting (built this way
  instead of a column, like the existing `group:<id>` tag).
- Happenings: reuse the event spine / activity rows filtered by realm rather than a new table, where possible.

## Server

- Access: `canModerateRealm` becomes power-aware — `realmPower(ctx, realm, power)` checks site admin, founder, or an
  officer holding that power. Claims review is the `claims` power (site admins, the founder, or an officer granted
  it in the claim's realm); an officer can't approve their own claim.
- Procedures (rate-limited mutations): factbook and appearance update, officer appoint/update/remove, embassy
  propose/accept/close, poll create/close/vote, board mute/ban/lift, `leaveRealm` (release own nation, confirmed),
  admin `adminTransferOwner` and founder `handOver` (both confirmed by the slug, audited), directory with
  tags/search/sort.
- `getBySlug` enforces status and visibility (drafts hidden from non-admins; archived read-only).

## Amendments (2026-10-07)

Owner decision: imported community realms such as Eurth are run by their own leaders.

- **Transfer (site admins):** `realms.region.adminTransferOwner` (replacing `assignFounder`) hands a realm to an
  active account picked from the admin user list, or back to staff. The admin types the realm's slug (checked on
  the server); an `AdminAuditLog` row (`REALM_OWNER_TRANSFERRED`) keeps the previous owner; the new founder (and a
  replaced founder) is notified. IxWorld stays with staff.
- **Hand over (founder):** Manage → Hand over (`realms.region.handOver`), same typed confirmation and audit row; the
  new founder must own a nation in the realm or be one of its officers. Site admins acting as founder use
  `/admin/realms` instead.
- **Previous founder:** loses the founder's powers, or (checkbox "Keep previous owner as officer") stays on as a
  "Former founder" officer holding every power. The new founder's officer post is dropped.
- **`claims` power:** grantable to officers ("Claims: review players' claims on the realm's nations"). They see the
  Manage tab's Claims section and review claims in that realm only; they can't approve their own claim.

## Current state (audit, 2026-10-05)

- `/r/[realm]`: one column — header (name, description, thumbnail), nations list, claimable nations, wiki portal link.
- `/r/[realm]/board`: ThinkTanks-based board with Board, Chat and Realm-feed tabs; persona posting.
- `/realms`: card directory and a realm-feed picker.
- Founder (`Realm.ownerId`) is never displayed or assignable; claims review UI exists only in `/admin`.
- Not present: factbook editor, banner, officers, embassies, realm polls, tags, census on the realm page, happenings,
  leave action. Realm-scoped census and leaderboards exist (MyCountry, `/leaderboards?realm=`).
