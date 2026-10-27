# Concept A: Lean IxForum (keep XenForo)

**Date:** 2026-10-07
**Status:** Approved design, competing with [Concept B](2026-10-07-forum-concept-b-thinkpages-forum-design.md). Pick one.
**Depends on:** [Action-linked posts](2026-10-07-action-linked-posts-design.md)
**Origin:** Kistan (Keaor) and Heku discussion, 2026-10-07: "keep or drop forum"

## Problem

Messages, ThinkTanks and ThinkPages all lean closed or in-character. The platform needs a public, out-of-character town square. A full platform forum duplicates Discord, so whatever stays should be lightweight and woven into the rest of IxStats.

## Concept

Keep XenForo at forum.ixwiki.com as the backend. Make the IxStats side thinner (fewer pages, no bespoke theme) and push forum content into the places people already are: realms, the Dashboard feed, country pages, MyCountry.

## Strip

| Remove | Replacement |
| --- | --- |
| `/forum/members/[userId]` | Author names link to the IxnayID / country profile |
| `/forum/search` | Forum threads become a source in Halo global search |
| `/forum/bookmarks` | Stash already lists stashed threads |
| `src/styles/forum.css`, `ForumLayout`, forum-specific `ForumContext` state | Standard Facet `Card`s under the Forum tint (Red, per the Facet spec) |

Kept routes: `/forum`, `/forum/[forumId]`, `/forum/thread/[threadId]`, `/forum/new-thread`, and the `/forum/conversations*` redirects. Delete any router procedures left with zero callers after the strip.

## Integrate

### 1. Automatic account link

- `requireForumUser` (`src/server/modules/forum/services/linked-user.ts`): when a user with no `forumUserId` writes for the first time, create the XenForo user through the API (`POST /users/`) with their IxnayID name and save `forumUserId` / `forumUsername`.
- If the name is already taken on XenForo, return a typed error that sends the user to the existing code-on-profile verification to claim that account.
- Verification (`forum-link-verification.ts`) stays, but only as the claim path.

### 2. Realm sub-forums

- Add `Realm.forumNodeId Int?`.
- A realm-creation hook provisions a XenForo forum node under a "Realms" category (`POST /nodes/`) and stores the id. Failure is logged and retried; realm creation never fails because of it.
- Backfill script for existing realms (idempotent: skips realms with a node).
- Realm Boards stay as they are and gain a "Forum" tab listing the node's threads, with the inline composer.

### 3. Dashboard feed

- `UnifiedFeedContent` gains a forum source: recent threads from the viewer's realm node plus the sitewide General forum.
- Uses the existing `cachedFetch` TTLs; no new XenForo load pattern.

### 4. Inline composer everywhere

- `ReplyComposer` / `ThreadComposer` (`src/components/forum/composer/`) accept `threadId` or `nodeId` props so they mount anywhere.
- Mounted on realm pages, country pages and MyCountry.
- **One-click focus fix:** activating the composer focuses the text field directly (today it needs a select click, then a second click into the field).

## Action links

- `transformBBCode` (`src/server/modules/forum/lib/bbcode-transformer.ts`) renders `[ixaction=…]` as the action card.
- The forum writing router parses tokens on create and edit, runs the ownership check, and writes `PostActionLink` rows with `postSource: "xenforo"`, `postRef` = XenForo post id.
- XenForo itself shows the raw token; the card only renders inside IxStats. Accepted.

## Trade-offs

- **For:** cheapest; keeps XenForo's mature moderation; no data migration.
- **Against:** permanent external dependency; no persona authorship (XenForo has no persona concept); every new feature crosses the API bridge; raw `[ixaction]` tokens on forum.ixwiki.com.

## Testing

- BBCode transformer: `[ixaction]` renders a card, unknown id renders "unverified action".
- Auto account link: mocked XenForo, success path and username-taken path.
- Node provisioning hook and backfill idempotency.
- Dashboard forum feed source returns realm + General threads.

## Appendix: MyCountry Overview colour

Unrelated to the forum, raised in the same review. Give the MyCountry Overview cards MyCountry Gold tint accents through semantic tokens, within Facet rules (no glows, no hardcoded hexes). Its own small change.
