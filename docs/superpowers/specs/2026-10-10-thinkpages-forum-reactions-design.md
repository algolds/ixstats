# ThinkPages forum, sub-project 4: reactions

**Date:** 2026-10-10
**Status:** Approved for execution (owner, 2026-10-10: "work on projects 3-7 now"). Decisions the concept leaves open are controller rulings, marked *Ruling*.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md). **Builds on:** sub-project 3 (unread and notifications).
**Branch:** `feat/forum-reactions`, cut from rose-garden after sub-project 3 merges.

## Owner decisions in force

- Reactions go on thread posts and realm board messages, using the Dashboard's reaction set and popup.
- The persona rule applies: a persona post never reveals its player.

## 1. Data (migration `20261016120000_thinkpages_forum_reactions`, hand-written and idempotent)

- **`ForumPostReaction`**
  - Fields: `id`, `postId` (FK ForumPost, cascade), `userId` (FK User, cascade), `type` (string), `createdAt`.
  - Unique `[postId, userId]`, so each user has one reaction per post. Index `[postId, type]`.
- **`ForumPost.reactionCounts`**
  - `Json`, default `{}`, holding the denormalized `{type: count}`.
  - It is updated in the same transaction as the reaction row.
- **Reaction types.**
  - Built-in: the Dashboard's `like`, `laugh`, `angry`, `fire`, `thumbsup`, `thumbsdown`.
  - Discord: `discord:<name>` or `discord:<name>:<id>`, with name `[A-Za-z0-9_]{2,32}` and id digits.
  - One shared validator lives in `src/lib/` and is used by both server and client. `sad` is not offered because it has no icon.

## 2. Rules

- *Ruling:* reactions are the player's own, not a persona's. They are an out-of-character act.
  - The reactor list shows the player's handle and flag.
  - This never reveals a persona's player, because the reacted-to author is shown as displayed on the post and the reactor is just a player.
- **Who may react**
  - On a thread post: anyone signed in who can read the thread and is not banned in its scope.
  - On a board message: anyone who can post on that board, so not visitors while visitors are off, and not banned users.
  - Nobody can react to hidden posts, continued placeholders, or their own posts. Archived realms and locked threads are read-only.
- **Toggling**
  - Clicking your current type removes the reaction.
  - Clicking another type switches it, as the Dashboard does.
- **Notification**
  - The first reaction from a given reactor on a post sends the post's owning user one bell notification: "<reactor handle> reacted to your post in <thread title or realm board>". It uses source `thinkpages-forum` and links to `postHref`.
  - Switching or removing a reaction sends nothing.
  - Reactions on persona posts notify the owner with the same title.
  - It is best effort and never blocks the reaction.
- **Rate limit:** the existing rate-limited mutation procedure.

## 3. API (`thinkpagesForum` router, thin over a new `reactions.ts` module)

- **`react({ postId, type })`** returns `{ counts, mine }`. On the board it publishes `publishBoardPost(..., "updated")` so live readers see the new counts.
- **`unreact({ postId })`** returns `{ counts, mine: null }`.
- **`reactors({ postId, type? })`** is public and readable by whoever can read the post. It returns up to 50 reactors per type, each with handle, flag and avatar.
- **Reads.**
  - The thread read and the board read add `reactions: Record<string, number>` to each post.
  - For signed-in viewers they also add `myReaction: string | null`, from one batched query per page.
- **Live board payload.** `boardMessagePayload` and the client `boardLiveMessageSchema` gain `reactions`, the counts only.
  - `myReaction` never goes on the wire.
  - `toCachedMessage` keeps the cached `myReaction`, the same way it keeps `byViewer`.

## 4. UI

- **Reaction bar** (`src/components/thinkpages-forum/reactions/`)
  - It mounts as the first control in `PostActions` (thread posts) and in the BoardMessage action row.
  - A "React" ghost Button toggles `like`. A long press or right-click on it, or a chevron next to it, opens the Dashboard `ReactionPopup` in the `ui` Popover.
  - Pills with counts come before Reply, using the existing `ReactionPills` look, built from `REACTION_ICONS` and the Discord emoji helpers.
  - Clicking a pill opens a reactors dialog built on the `ui` Dialog.
  - The `ReactionPopup`, `REACTION_ICONS`, Discord helpers and cache-patch logic are reused. The ThinkpagesPost-coupled mutation hook is not.
- **Optimistic update.** Patch the `thinkpagesForum.thread` and `getBoard` caches in `onMutate`, restore them in `onError`, and settle by taking the server's `counts`.
- **Visibility.**
  - Signed-out readers and anyone who cannot react see the pills but get no React button.
  - Pills are hidden on a post with no reactions.
- Facet: iconoir icons, `ui` primitives, tinted active state for `mine`, no emoji in UI copy. Discord emoji images are user content, not UI copy.

## 5. Testing

- **Validator:** built-in and Discord type formats, and rejected inputs.
- **Toggle and switch:** count maths, and concurrency through the unique row plus the transaction.
- **Permission matrix:** visitor, banned, hidden, placeholder, own post, archived, locked, signed out.
- **Notifications:** sent on the first reaction only, and persona owner routing.
- **Reads:** batched counts and `myReaction`.
- **Live board payload:** counts present, `myReaction` absent.
- **Live cache merge:** keeps `myReaction`.
- **UI:** reaction bar states, popup, reactors dialog, optimistic rollback.
- **Browser check:** react on a thread post and a board message. A second session sees the board count arrive live (by polling in dev).
