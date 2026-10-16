# ThinkPages forum: refined forum, ThinkPages posts

Status: owner decisions recorded 2026-10-15; awaiting spec review. Direction C from the forum audit.
Drafts: the "ThinkPages forum drafts" canvas (rows A and C). Colours: the IxStates brand colours guide (applied the same day).

## Why

The 2026-10-15 audit of the forum and the ThinkPages social UI found:

- The forum's structure is right. The native-concept spec chose boards, threads, quoting, roles and `#N`
  permalinks on purpose, and long in-character roleplay needs them.
- The design pass stopped at the home page. The home-design spec planned a second pass for the board, thread and
  realm pages (home-design:99-101) that never shipped, so one click in the forum turns into a plain grid. Post
  headers sit on shaded bands, unread state has four looks, and author lines are copied between surfaces.
- Most of the "ThinkPages design" is a generic social clone (Repost/Like pills, a box per post, emoji). What is
  ours is the persona layer: government, media and citizen voices, "Posting as… Switch", IxTime, and wiki and
  nation embeds. That is what the forum should take.

## Goals

1. One author line for every forum surface, carrying the persona's voice.
2. Thread posts without the shaded header band, with in-character posts set as prose on the Facet type scale.
3. The board page gets the design pass the home page got.
4. One unread treatment everywhere.
5. The home page leads with the forum: a page header, Your realm in the main column, and a feed of new threads.

## Non-goals

- The Dashboard social feed (`StandardPostView`, `HeroPostView`) and ThinkShare. They can adopt the author line
  later.
- A persona's nation or flag. The privacy rule in `src/server/modules/thinkpages-forum/authors.ts` stays: a persona
  is its name, picture and (new) type, never a flag, so the player behind it cannot be traced.
- New embed types or composer changes, reactions merged with the social side, moderation.

## Design

### 1. The author line

One component, `AuthorLine`, in `src/components/thinkpages-forum/AuthorMark.tsx`, used by thread posts
(`thread/PostHeader.tsx`), realm board messages (`realm/BoardMessage.tsx`), the home feed and the rails:

- Avatar (36px in posts, 28px in rows), name in `text-headline`.
- A member: their flag (`AuthorFlag`) and role chip (Staff, Moderator), as today.
- A persona: a type chip, Government, Media or Citizen, as text with an iconoir icon (Crown, Journal, Community),
  in the neutral chip style (`fill-3`, `label-secondary`; owner decision). Personal accounts show no chip. No flag.
- Imported posts: the XenForo name and an "Old forum" chip, as today.
- Time: relative IxTime ("2h", "Jun 7"), with the absolute date and "IxTime" in the `title`.

Server: `authorsOf` selects `accountType` for personas and returns it on `ForumPersonaAuthor`. The flag markup copied
in `PostHeader.tsx:70-77` and `BoardMessage.tsx:66-74` goes.

### 2. Thread posts

- The header is the author line with the `#N` permalink at the end. The shaded `facet-well` band goes. The body,
  quotes and actions indent to the name column (46px), as in the C thread draft.
- In-character posts keep the WikiOS reading face on the Facet prose scale: 17px at 1.6 leading, headings at
  `title-2` and `title-3`, the infobox at `callout`. The raw pixel sizes in `src/styles/thinkpages-forum.css`
  (lines 26, 37, 50, 98) go. The 820px article width stays, because the floating infobox needs it (the
  `[data-content="prose"]` scope would centre every child at 70ch). Out-of-character posts use `text-body`.
- Actions keep today's set and order: React, Reply, Quote, Share, More, as ghost buttons, with reaction pills
  first. Stash stays on the thread, in the header (`StashThreadButton`); no post-level Stash (owner decision).
- Posts stay in one pane, divided by separators (Facet `feed`).

### 3. The board page

- `ThreadTable` rows: 28px avatars, the title in `text-headline`, one meta line, 36px rows (44px on coarse
  pointers), `fill-4` row hover.
- One sort control: the column headers from `md` up and `SortMenu` below. Today both show.
- The board description appears once, in the header. The rail keeps posting rules and top posters.
- Pinned threads keep their group band, and the page-number shortcuts stay.

### 4. One unread treatment

A tint dot before the title and the title in semibold, through one `UnreadMark` component. It replaces the four
variants at `BoardList.tsx:112-137`, `ThreadTable.tsx:219-242`, `RealmRail.tsx:47-51` and `YourRealmPanel.tsx:67`,
including the row tint wash and the left rule.

### 5. The home page

- The textured masthead goes, leaving the plain `PageHeader` (Facet allows no hero card as a header): "ThinkPages",
  the board totals, and New thread as a menu of the boards the viewer may start one in. "Posting as" stays in the
  composer: the persona is chosen per post and no default is stored, so a home-level switch would be a new feature
  (amended while planning, 2026-10-15).
- Your realm moves from the rail into the main column, above the boards (both earlier specs asked for this). It
  shows the realm's emblem, the number online and the newest board message.
- Board rows show the last post as an inline column (thread title, then "name · time"), in place of the nested
  latest-thread card (owner decision; this retires the card's border change of the same day).
- Latest activity moves from the rail into the main column as "New across ThinkPages": a `feed` pane of new threads
  with the author line and an "In character" chip. The rail keeps ThinkTanks and Trending.

### 6. Delete New posts and Watched (owner decision)

Nothing has linked to these pages since their sidebar entries were dropped. Delete:

- The routes `src/app/thinkpages/new/page.tsx` and `src/app/thinkpages/watched/page.tsx`, the components
  `src/components/thinkpages-forum/lists/` (`NewPostsPage`, `WatchedPage`, `index.ts`) and `NEW_POSTS_HREF` and
  `WATCHED_HREF` in `src/lib/thinkpages-forum/links.ts`.
- The procedures `thinkpagesForum.newPosts` and `thinkpagesForum.watchedThreads`
  (`src/server/api/routers/thinkpagesForum/engagement.ts`), their invalidations in `useReadStateRefresh.ts`, and
  `listNewPosts` and `listWatched` (`src/server/modules/thinkpages-forum/thread-listing.ts`, `index.ts`).
- Their tests (`lists.test.tsx`, the two `thread-listing.test.ts` blocks, and the mocks in `BoardPage`,
  `ThreadActions` and `ThreadPage` tests), and any helper the deletions leave unused (check `useLastPageRedirect`
  and `pageHref`), confirmed by grepping each symbol after the deletion.

Watching a thread (`useWatchToggle`, `watchThread`, `unwatchThread`) and `navCounts` stay: the sidebar badge and
the realm panels still read unread counts.

## Phases

One PR into rose-garden per phase, built in a worktree cut from `origin/rose-garden`. The main checkout carries
other work.

1. The author line (server `accountType` included), thread posts, and the New posts and Watched deletion.
2. The board page and the unread treatment.
3. The home page.

## Testing

- Component tests for each surface. Update `ForumHome`, `ThreadTable` and the post header tests, and add tests for
  `AuthorLine` (member, persona of each type, personal, imported) and `UnreadMark`.
- A server test for `authorsOf` returning `accountType` and still never a persona flag.
- `facet-ratchet` (counts only fall), `facet-guards`, `facet-phase4-leftovers` and `token-contrast` stay green.
- `typecheck:ui`, `typecheck:server` and `typecheck:trpc` (clear `tsbuildinfo` first after any deletions), and lint.
  No builds.
- A signed-in browser check of the thread, board and home pages in both modes on the `ixstats_wv1` clone.

## Decisions (owner, 2026-10-15)

1. Persona type chips are neutral, not coloured per type.
2. Stash stays on threads; no post-level Stash.
3. New posts and Watched are deleted (section 6).
4. The home's latest-thread card becomes the inline last-post column.

Already done the same day, outside this spec: the material palette (Commons leather for ThinkPages), and the
`py-2.5` fix in `PostInlineLinkPreview.tsx`.
