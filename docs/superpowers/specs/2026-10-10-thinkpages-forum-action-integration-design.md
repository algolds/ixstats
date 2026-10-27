# ThinkPages forum, sub-project 5: action integration

**Date:** 2026-10-10
**Status:** Approved for execution (owner, 2026-10-10: "work on projects 3-7 now"). Decisions the concept leaves open are controller rulings, marked *Ruling*.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md). **Earlier design:** [2026-10-07-action-linked-posts-design.md](2026-10-07-action-linked-posts-design.md).
**Branch:** `feat/forum-actions`, cut from rose-garden after sub-project 4 merges.

## Owner decisions in force

The concept settles these:
- All four pieces are in scope: Attach action in every composer, Share from MyCountry, backlinks on the action, and credit rewards.
- Credits are a small flat reward the first time an action is posted, with one payout per action and about 3 rewarded actions per country per day. Amounts live in admin config.
- "Plan in forum, act mechanically, flavour in forum."

## Starting point

The scout found the following (file references are in the plan):
- **Attach action is built and mounted** in the Canvas, light and board composers.
  - The token is `[ixaction=<ActivityFeed.id>]`, validated against the actor's country and public `ActivityFeed` rows, and synced to `PostActionLink`.
  - The picker rows show only the title.
- **Backlinks have only a raw query.** `PostActionLink` indexes `activityId`. The public `actionLinks.linkedPosts` returns unhydrated refs and leaks hidden or private posts. Nothing in the UI uses it.
- **Directives write no `ActivityFeed` row**, so they cannot be attached. Directives are the core MyCountry action ("Directives ★").
- **Credits:**
  - `earnCreditsOnce` is idempotent through its key.
  - `VaultBonusConfig` and `getBonusConfig`/`setBonusConfig` hold admin-tunable amounts, with the admin UI in `VaultBonusAdmin`.
  - No per-country daily cap exists.

## 1. Directives become attachable

- When a directive is committed and `isPublicDirective` holds, `intent.commit` writes one public `ActivityFeed` row:
  - type `"directive"`, category `"government"`, title = the directive title;
  - `metadata.intentId`, `countryId`, `userId`.
- The write uses `recordActivity`, inside or immediately after the commit, and is idempotent per intent through a lookup on `metadata.intentId` before insert.
- *Ruling:* a private directive gets no row, so the forum cannot reveal it. `commit` returns `activityId: string | null`.
- When a directive completes there is no new row. The one row is the directive's identity.
- *Ruling:* national issues, meetings and policies stay unlinkable in this sub-project. Directives are the universal action brand, and the existing ActivityFeed sources (embassies, alliances, laws, achievements, tiers) already work.

## 2. Attach action polish

- Picker rows show an iconoir icon per category, the title, the type label and the IxTime date.
- The picker gains a "Recent" default list: the newest 10 rows. The 30-item search list stays.
- *Ruling:* the picker hides the `ActivityFeed` types that are not actions a player takes: Onoma name generation, nation founded, economic tier changes and achievement unlocks. A denylist constant in `src/lib/action-links.ts` drives this. Existing tokens of those types still render.
- **Prefill.** Composers accept an `attach` query parameter holding an activity id the viewer owns, and insert its token once on mount.
  - Board: `/thinkpages/r/<realm>?attach=<id>`.
  - New thread: `/thinkpages/c/<board>/new?attach=<id>`, or the realm Hub equivalent.
  - The parameter is read client-side and validated by the normal post-time validation. An invalid id just fails like a hand-typed token.

## 3. Share from MyCountry

- **`ShareToRealmButton`** (`src/components/action-links/`).
  - Shown when the viewer's country is in a realm. Otherwise it is replaced by nothing.
  - It is a `ui` DropdownMenu with "Post on the <realm> board" and "Start a thread in <realm> Hub". Each navigates to the prefilled composer from section 2.
  - It mounts on:
    - `DeclaredCard`, after a successful commit that returned `activityId`;
    - `IntentDetail`, next to "Share to the feed…", for the directive's activity row looked up by `intentId`;
    - the action cards rendered in forum posts are excluded, since they're already in the forum.
- *Ruling:* other MyCountry confirmation surfaces (embassy, alliance, bill) are not wired in this sub-project. Their hooks don't return the activity id, and the composer's Attach action already covers them.

## 4. Backlinks ("Discussed in")

- **`actionLinks.discussions({ activityId, cursor? })`** is public and viewer-aware.
  - It returns visible linking posts, newest first, 20 per page. Each has the thread title, a permalink (`postHref`), the persona-safe displayed author, the board or realm name, and `createdAt`.
  - Posts are filtered through the forum's existing visibility rules for the viewer: category and realm visibility, the hidden flag (moderators see hidden ones marked), private Reports threads, and archived realms readable as usual.
- **`actionLinks.discussionCounts({ activityIds })`** returns visible counts for up to 50 ids, batched.
- The old `linkedPosts` procedure is removed, since nothing calls it and it leaks.
- **Mounts:**
  - `IntentDetail` gains a "Discussed in N posts" section, with a list from `discussions`.
  - The activity cards in the Home global feed (`UnifiedFeedItem` activity rows) and on the country activity panel show "Discussed in N posts", linking to the first post when N is 1. Otherwise the link expands an inline list.
  - The forum `ActionCard` shows the count too, minus the current post.

## 5. Credit rewards

- **Config.** `VaultBonusConfig` gains:
  - `forumActionReward`, default 5 IxC;
  - `forumActionDailyCap`, default 3 rewarded actions per country per UTC day.

  Both are added to the zod schema in `cards/settings.ts` and to a "Forum" group in `VaultBonusAdmin`.
- **Schema.** `PostActionLink` gains `rewardedAt DateTime?` with an index `[countryId, rewardedAt]`, in migration `20261017120000_action_link_rewards`.
- **Rule.** After `syncPostActionLinks` returns the links it newly created (its return value changes to `{ created: string[] }`), each new link may earn a reward when all of these hold:
  - the post is a native forum post, not hidden;
  - the activity has never been rewarded on any link;
  - the country's count of `rewardedAt` today is under the cap.
- **Mechanics.**
  - The check takes `pg_advisory_xact_lock(hashtext('action-reward:' || countryId))` inside a transaction. It then sets `rewardedAt` and calls `earnCreditsOnce` with key `forum_action:<activityId>`, type `EARN_SOCIAL` and source `forum_action`.
  - The global key makes "one payout per action" hold even across delete-and-relink edits.
  - The kill switch and the social daily cap still apply, because `earnCreditsOnce` enforces them.
  - The reward goes to the posting user, even for persona posts. It is private to their vault.
- **Feedback.** `createThread`, `reply` and `postBoardMessage` return `reward: { amount } | null`. The composer shows a success `Signal`: "+5 IxC for posting your action". The copy uses the configured amount.
- Moderator hides don't claw back credits.

## 6. Testing

- **Directive rows:** a directive commit writes exactly one public row, none for a private directive, and is idempotent on retry.
- **Picker:** the denylist, the recent list, row shape.
- **Prefill:** the `attach` parameter inserts once, and an invalid id is refused at post time.
- **ShareToRealmButton:** visibility (no realm means nothing) and its targets.
- **`discussions` visibility:** hidden, private realm, Reports thread, board messages for visitors, persona-safe author.
- **Counts:** batching.
- **`linkedPosts`:** removed.
- **Reward rules:**
  - first link only;
  - relink after delete pays nothing;
  - the per-country cap holds under concurrency (two posts at the cap);
  - hidden posts pay nothing;
  - the kill switch is honoured;
  - config amounts are applied.
- **`syncPostActionLinks`:** returns only the created links.
- **Reward Signal:** shown in the composer.
- **Browser check:** declare a directive, share it to the board, see the action card and the reward Signal, and see "Discussed in 1 post" on the directive.
