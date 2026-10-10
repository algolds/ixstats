# ThinkPages forum, sub-project 6: Find a Realm adverts

**Date:** 2026-10-10
**Status:** Approved for execution (owner, 2026-10-10: "work on projects 3-7 now"). Decisions the concept leaves open are controller rulings, marked *Ruling*.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md).
**Branch:** `feat/forum-adverts`, cut from rose-garden after sub-project 5 merges.

## Owner decision in force

Find a Realm holds one advert thread per realm. The realm's officers own it, and a live realm card with Join/Apply heads it.

## Starting point

- The sitewide `find-a-realm` category already exists. It is seeded in `categories.ts`, and imported XenForo recruitment threads land in it.
- `ForumThread` has no field linking it to a realm.
- Joining a realm means claiming a nation (`RealmClaim`; `fileClaim` either auto-approves or files a pending claim), with invite links `/r/<slug>?via=`.
- `REALM_POWERS` is `appearance`, `board`, `diplomacy`, `claims` and `map`. The founder and site admins hold all of them.
- `realms.region.overview` returns everything a realm card needs. `RealmCard` is a local component inside `BrowseRealms.tsx`.

## 1. Data (migration `20261018120000_thinkpages_realm_adverts`)

- `ForumThread.advertRealmId String? @unique` is a foreign key to `Realm`, `onDelete: SetNull`.
- At most one advert per realm. Existing imported threads keep a null value.

## 2. Rules

- **Who manages the advert.** Realm officers with the `appearance` power, plus founders and admins, can create the advert, edit its first post, and lock or unlock it.
  - *Ruling:* this reuses `appearance` (the realm's public face) instead of adding a power.
- **One per realm.** "Advertise your realm" opens the new-thread form in Find a Realm with the realm fixed. If an advert already exists, the button reads "Edit your advert" and opens it.
  - The server refuses a second advert with CONFLICT and returns the existing thread id.
- **Who can start new threads in Find a Realm.**
  - *Ruling:* only realm adverts, by officers who hold the power.
  - Members may still reply to any thread, to ask questions.
  - Moderators keep their existing tools.
  - Existing imported threads are unchanged.
- **When the advert is hidden.** It is excluded from the board table, Forums home and latest-post reads for anyone who cannot see the realm: draft, hidden, or deleted (`advertRealmId` set to null by the foreign key means it becomes an ordinary thread).
  - An archived realm's advert stays readable and is locked automatically.
- **Bumping.** *Ruling:* there is no manual bump. Adverts sort by last post like every thread. An officer's edit to the first post doesn't bump.

## 3. UI

- **Live realm card.** Extract `RealmCard` from `BrowseRealms.tsx` into `src/components/realms/RealmCard.tsx`, keeping the directory's appearance and props. Add a `variant="advert"`:
  - wider banner, emblem, tags, member and nation counts, "N online on the board" when known, rules link;
  - the primary action is "Join" when `claimsOpen`, opening the existing claim flow (`/r/<slug>?via=` honoured), otherwise "Closed to new nations";
  - "Visit the board" links to `/thinkpages/r/<slug>`;
  - the data comes from `realms.region.overview`, so the card is live and never a stored snapshot.
- **Thread page.**
  - When `advertRealmId` is set, the thread read returns `advert: { realmSlug }` and the page mounts the card above the feed `Card`, where the hidden and imported notices sit.
  - The rail adds "About <realm>" with the founder and officers.
- **Find a Realm board page.**
  - Advert rows show the realm emblem (falling back to the thumbnail, then the realm mark) in place of the author avatar, and an "Open to join" pill when claims are open.
  - The header action is "Advertise your realm" or "Edit your advert" for viewers with the power in at least one realm, with a realm picker when they hold it in several.
- **Realms app.** The realm Manage page gets an "Advert" row: a link to the advert, or "Create advert".

## 4. Testing

- **Migration and schema:** idempotent.
- **One per realm:** the CONFLICT carries the existing id.
- **Power matrix:** an officer with `appearance`, without it, the founder, an admin, a member.
- **Non-advert new threads refused in Find a Realm.**
- **Replies:** allowed.
- **Hidden-realm exclusion:** in each read (board table, home, latest, thread read).
- **Archived:** the advert is locked.
- **FK set-null:** on realm delete.
- **RealmCard extraction:** the directory snapshot is unchanged.
- **Advert variant:** join or closed states, invite parameter.
- **Thread page:** card mount and rail.
- **Board rows:** emblem and pill.
- **Browser check:** an officer creates an advert, a second session sees the card and Join, the board row shows the emblem, and a second advert attempt reaches "Edit your advert".
