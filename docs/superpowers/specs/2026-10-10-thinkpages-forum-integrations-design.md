# ThinkPages forum, sub-project 7: IxStates integrations

**Date:** 2026-10-10
**Status:** Approved for execution (owner, 2026-10-10: "work on projects 3-7 now"). Decisions the concept leaves open are controller rulings, marked *Ruling*.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md).
**Branch:** `feat/forum-integrations`, cut from rose-garden after sub-project 6 merges.

## Owner decisions in force

- Home feed items become real post previews.
- Home's rail gets a "Your realm" board panel.
- The Realms app links to the realm's board and its boards.

## Starting point

- **Home forum feed items** are one-line `ActivityCard`s ("New forum thread: X", "<author> posted in <category>").
  - They are built by `forumActivityItems` in `routers/activities/feed/global.ts` from `latestPublicThreads`, with no excerpt.
- **Home's rail** is the `Inspector` "Around IxStates" in `UnifiedDashboardSection.tsx`. It has no realm panel.
- **The Realms app** already has Board and Forums tabs, added in sub-project 2. Several things still point elsewhere:
  - `/r/<realm>/board` redirects to the Hub, not the live board.
  - The directory cards link only to the Hub.
  - The realm overview previews Hub threads only.
  - The realm feed (`thinkpages/realm-feed.ts`) still reads the old ThinkTank board chat.

## 1. Home feed post previews

- **Server.** `latestPublicThreads` and `forumActivityItems` carry a preview for the post an item refers to: the first post for a new thread, the latest visible reply for a reply. The preview has:
  - `excerpt`: the plain text, 280 characters, whole words, action tokens stripped;
  - the persona-safe author (name, avatar, flag, persona flag);
  - the board name and realm name with its emblem;
  - reply count and reaction total;
  - `postHref`.
- Still public-only. The board category stays excluded, and hidden posts are never previewed.
- **Client.** A new `ForumFeedCard` in `src/components/dashboard/feed/` replaces `ActivityCard` for `source === "forum"`. It has:
  - an author row (avatar, name, flag, "in <board>" link, relative time);
  - a thread title in the feed list-title style;
  - an excerpt clamped to 3 lines;
  - a footer with reply count, reaction total and "Open thread".
- An IC-category item renders its title in the wiki reading font, as on the thread page.

## 2. Home rail "Your realm" panel

- **`YourRealmPanel`** sits at the top of the Home `Inspector` for signed-in viewers whose country is in a realm. Others get nothing.
- **Contents:**
  - the realm emblem and name;
  - "N new on the board", from sub-project 3's `navCounts`;
  - the latest 3 board messages, each with a one-line persona-safe author and an excerpt of about 90 characters;
  - links to "Open the board" (`/thinkpages/r/<slug>`) and "Forums" (the realm Hub).
- **Data:** one new read, `thinkpagesForum.realmPanel`, that returns those three messages and counts. It reuses the board read's shaping and is not a full board page. Stale time is 60 seconds, with no socket.
- *Ruling:* a member of several realms through several countries sees the realm of their current country (`User.countryId`), matching "Your realm" in the sidebar.

## 3. Realms app link-up

- **Redirect.** `/r/<realm>/board` redirects to the live board, `/thinkpages/r/<slug>`.
- **Directory cards.** `RealmCard`, `YourRealmCard` and the `OpenToJoin` rows add a "Board" link next to "Forum". `RealmCard` is the component extracted in sub-project 6.
- **Overview.** The "Latest on the forum" panel gains a "On the board" block with the latest 3 board messages (the same read as the Home panel) above the Hub threads, and a "Open the board" CTA.
- **Directory activity.** *Ruling:* card activity counts board messages in a separate "N board messages this week" figure. It is not merged into the forum post count, so the board-exclusion invariant on forum reads still holds.
- **Old realm-board chat in the realm feed.** *Ruling:* the realm feed stops reading old ThinkTank board-chat posts and reads the newest board messages instead. These are public, persona-safe and already excluded from hidden posts.
  - The old ThinkTank plumbing (`ensureRealmBoard`, `realms.getBoard`, `RealmBoard` rows) stays until the owner runs the history import on production. Deleting it is a later owner-gated cleanup.

## 4. Testing

- **Feed preview shaping:**
  - the excerpt rules (length, word boundary, tokens stripped);
  - the persona-safe author;
  - hidden replies fall back to the newest visible one;
  - the board stays excluded.
- **`ForumFeedCard`:** its variants, including IC.
- **`realmPanel`:** visibility (a hidden realm gives nothing), persona safety, and a non-member gets null.
- **`YourRealmPanel`:** the states, including no realm.
- **The board redirect.**
- **Directory "Board" links.**
- **The overview board block.**
- **The board-week figure.**
- **The realm feed:** reads board messages and no longer reads the old chat.
- **Browser check:** Home shows a forum preview card and the Your realm panel. The realm overview shows the board block. `/r/<slug>/board` lands on the live board.
