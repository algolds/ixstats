# ThinkPages forum home redesign and ThinkTanks in the ThinkPages sidebar

**Date:** 2026-10-11
**Status:** Design approved by the owner in chat (2026-10-11), spec awaiting review.
**Branch:** `feat/forum-home-refresh`, cut from rose-garden.

## Owner decisions in force

- Home first. The board, thread, realm landing and list pages follow in a second pass that reuses this home's pieces.
- The Forum statistics panel goes. Latest activity, Find a Realm adverts and ThinkTanks replace it.
- Boards stay the main content, as board rows with a preview of the latest thread (the "board cards with previews" option).
- ThinkTanks joins the ThinkPages sidebar dropdown, directly after Forums.
- The home uses texture overlays and other visual flourishes, within Facet's rules.

## Starting point

- `ForumHome` (`src/components/thinkpages-forum/home/ForumHome.tsx`) renders `YourRealmCard`, a `BoardTable` for the sitewide boards, a collapsed `BoardTable` for the old forum's archive, and a rail with `TrendingPanel`, `StatsPanel` and `StandingPanel`.
- `thinkpagesForum.categories` already returns each board's counts, `latest` (thread title, author, time) and `unreadThreads`.
- `thinkpagesForum.category` with key `find-a-realm` already returns advert rows (`advertRowOf`).
- `thinkpages.getThinktanks({ type: "joined" | "all" })` already lists ThinkTanks.
- `forumStatistics` (`board-reads.ts`) is only used by the `forumStats` procedure and its own tests.
- ThinkTanks is a Home section in `src/lib/navigation/app-sections.ts`, and `/thinktanks` is in Home's `match`.

## 1. Sidebar

- Move the `thinktanks` section from Home to ThinkPages, directly after `forums`. It keeps its id, label, icon and `/thinktanks` href. Drop its `tint` override, since the ThinkPages app already wears the ThinkPages tint.
- Move `/thinktanks` from Home's `match` to ThinkPages' `match`, so the ThinkPages dropdown is open on every ThinkTanks page.
- Check that `src/app/thinktanks` sets `data-app="thinkpages"`, so the canvas wash matches the sidebar. If it doesn't, add it.
- Update `app-sections.test.ts` and `app-sections-badges.test.ts` for the move.

## 2. Main column

### Your realm

`YourRealmCard` keeps its content and gets the board rows' styling: the same icon tile treatment (see Flourishes) and the same row rhythm, so it reads as part of the same family.

### Board rows (replaces `BoardTable`'s grid table)

One `Card content="data"` per group ("Sitewide", "From the old forum"), titled with `CardTitle icon={...}`. Each board is a row:

- **Leading:** the board's icon in a tinted icon tile (Well).
- **Name line:** the board name (the row's stretched link, as today), a small tint dot when `unreadThreads > 0`, and a `Badge` "N new" beside it.
- **Description:** one line, `text-callout text-label-secondary`.
- **Counts:** threads and posts, right-aligned, `tabular-nums`, figure over unit from md up (the existing `Count`).
- **Latest preview:** a nested Well under the name and description. It shows the latest thread's title, the author's avatar and country flag (Facet exception 1), and the relative time. The preview links to the thread and is a pressable tile (`Card interactive`: `facet-lift` and `facet-press`). When a board has no threads, the preview says "No threads yet" in `text-label-tertiary`, without a Well.
- **Phones (below md):** the counts move under the description as one line ("3 threads · 9 posts"), and the preview spans the full row width.

"From the old forum" keeps its collapsed `Collapsible` and uses the same rows.

`BoardTable`'s header row (Thread / Threads / Posts / Latest) goes, since each row now labels its own counts.

## 3. Rail

Panels in this order. Each one is left out when it has nothing to show, and the rail is passed only when at least one panel has content (as today).

1. **Latest activity** (new). The six newest visible posts across sitewide and published realm boards. Each item: the author's avatar and flag, "Name replied in *Thread*" (or "started *Thread*" for a first post), the board name, and a relative time. Items are linked to the post's permalink. A thin separator line runs down the left edge, joining the avatars (a `feed` content type list).
2. **Trending threads.** Unchanged.
3. **Find a Realm.** Up to three open adverts from `category({ key: "find-a-realm" })`, each shown as the board page shows it (`AdvertMark` and the realm name), plus a "See all" link to the board. Locked adverts and adverts for archived realms are left out.
4. **ThinkTanks.** Signed in: `getThinktanks({ type: "joined" })`; signed out, or a signed-in member with none: `getThinktanks({ type: "all" })`. Either list is sorted on the client by `conversation.lastActivity`, newest first. Up to four rows (name, member count, last activity), and a "See all" link to `/thinktanks`.
5. **Your standing.** Unchanged.

### Removed

- `StatsPanel` (`HomeRail.tsx`), the `forumStats` procedure, `forumStatistics` and its module export, and its tests in `board-reads.test.ts` and `realm-board-exclusions.test.ts`.

## 4. New server read: latest activity

- `latestActivity(db, viewer, limit = 6)` in `src/server/modules/thinkpages-forum/board-reads.ts`, beside `trendingThreads`.
- **Visibility:** the same `where` as `trendingThreads`: post not hidden; thread not hidden or archived; `advertGate(null)`; category `notBoardCategory()` and either sitewide or in a published realm (`publishedRealmIds`). Posts in private, draft or hidden realms never appear.
- **Shape:** `{ postId, threadId, threadTitle, categoryName, isFirstPost, at, author }`, with the author resolved through the existing author helper (avatar, flag, persona handling) so it matches thread rows.
- **Procedure:** `thinkpagesForum.latestActivity`, a `publicProcedure` with `limit` 1 to 10, default 6. It's registered in `forumRouter`, beside `trending`.

## 5. Flourishes (within Facet)

Facet's ratchet test blocks glows, glow blobs, `hover:scale`, gradients on UI, emoji, decorative Sparks and uppercase labels, so none of those are used. The flourishes are:

- **Textures:** `TextureOverlay` with sanctioned textures only. It's capped at 5% opacity, honours the Settings textures toggle, and never sits under data.
  - `dots` on every board icon tile and on Your realm's tile.
  - `paperGrain` across the Your realm card's leading tile area.
  - `grid` behind the rail panels' empty states and the "No boards yet" empty state.
- **Material:** board icon tiles are tinted Wells with the app tint mixed in. Latest previews are nested Wells inside the board Pane, so glass never sits on glass.
- **Motion:**
  - Board rows and rail panels fade and rise in once on first load, staggered by 40ms per item, with `springGentle`. With Reduce Motion they use a plain fade.
  - Previews use `facet-lift` and `facet-press`; rows use the `fill-4` hover.
- **Unread:** a tint dot and an "N new" badge per board. Neither pulses.
- **Copy:** no subtitles that repeat the title, and no em dashes.

## 6. Testing

- **Unit (`board-reads.test.ts`):** `latestActivity` returns posts newest first. It leaves out hidden posts, hidden and archived threads, realm-board categories, and posts in unpublished realms, and it marks first posts.
- **Component (`ForumHome.test.tsx`, `pages.test.tsx`):**
  - The rail drops Forum statistics.
  - Latest activity, Find a Realm and ThinkTanks render when they have data and are left out when empty.
  - Board rows show the unread badge.
- **Navigation:** ThinkTanks is a ThinkPages section after Forums, and `/thinktanks` resolves to the ThinkPages app.
- **Gates:** `typecheck:ui`, `typecheck:server` and `typecheck:trpc` (with tsbuildinfo cleared after the deletions), `bun run lint`, and `facet-ratchet.test.ts`, `facet-guards.test.ts` and `app-palette.test.ts`. No builds.
- **Browser:** a signed-in check on the `ixstats_wv1` clone at 1440, 1180 and 390px, in dark and light, with the textures toggle on and off.

## Second pass (not in this spec)

The board, thread, realm landing, New posts, Watched, Stashed and Moderation pages adopt the row, tile, texture and motion treatment from this home. That pass gets its own short spec.
