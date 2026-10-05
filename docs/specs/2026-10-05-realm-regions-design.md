# Realms as NationStates-style regions — design

**Last updated:** 2026-10-05 · **Status:** design agreed with the owner, not yet built

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
| Officer powers | Grantable: **edit factbook & header**, **moderate the board**, **embassies & polls**. Founder-only: **review claims**, appoint officers |
| Embassies | **Yes, with cross-posting:** one realm proposes, the other accepts; listed in the sidebar; board posts flagged for embassies show on the partner realm's board |
| Removing nations | **Board mute/ban only.** Founders and officers can stop a nation posting on the board; they cannot take a nation out of the realm |
| Sidebar | Officers, **census panel** (the 10 realm-scoped World Census categories, switchable), **realm poll** (one active poll), **happenings** (game events: new nations, claims approved, elections, treaties) |
| Manage UI | A **Manage tab**: Appearance (banner), Factbook, Officers, Claims (founder), Embassies, Polls, Board moderation |
| Founders of existing realms | **Site admins assign** founders in `/admin/realms`; until then the realm shows "Administered by IxStats staff" and site admins act as founder |
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

- `Realm`: `bannerUrl`, `factbookHtml` (sanitized), `factbookUpdatedAt`, `tags String[]`, `foundedAt` (default
  `createdAt`). `ownerId` stays the founder (`"system"` = staff-administered).
- `RealmOfficer`: `realmId`, `userId` (Clerk id), `title`, `powers String[]` (`appearance`, `board`, `diplomacy`),
  `appointedBy`, timestamps; unique `(realmId, userId)`.
- `RealmEmbassy`: `realmAId`, `realmBId`, `status` (`proposed` / `active` / `closing` / `closed`), `proposedBy`,
  timestamps; unique pair.
- `RealmBoardBan`: `realmId`, `countryId`, `kind` (`mute` / `ban`), `reason`, `until?`, `createdBy`.
- Polls: reuse `Poll` with a nullable `realmId` (one active per realm).
- Board posts: an `embassyVisible` flag on realm-board posts for cross-posting.
- Happenings: reuse the event spine / activity rows filtered by realm rather than a new table, where possible.

## Server

- Access: `canModerateRealm` becomes power-aware — `realmPower(ctx, realm, power)` checks site admin, founder, or an
  officer holding that power. Claims review stays founder/site admin.
- Procedures (rate-limited mutations): factbook and appearance update, officer appoint/update/remove, embassy
  propose/accept/close, poll create/close/vote, board mute/ban/lift, `leaveRealm` (release own nation, confirmed),
  admin `assignFounder`, directory with tags/search/sort.
- `getBySlug` enforces status and visibility (drafts hidden from non-admins; archived read-only).

## Current state (audit, 2026-10-05)

- `/r/[realm]`: one column — header (name, description, thumbnail), nations list, claimable nations, wiki portal link.
- `/r/[realm]/board`: ThinkTanks-based board with Board, Chat and Realm-feed tabs; persona posting.
- `/realms`: card directory and a realm-feed picker.
- Founder (`Realm.ownerId`) is never displayed or assignable; claims review UI exists only in `/admin`.
- Not present: factbook editor, banner, officers, embassies, realm polls, tags, census on the realm page, happenings,
  leave action. Realm-scoped census and leaderboards exist (MyCountry, `/leaderboards?realm=`).
