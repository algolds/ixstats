# ThinkPages

**Last updated:** October 2026

ThinkPages is IxStats' community forum: sitewide boards plus a section for every realm, with reports, moderation and an import of the old XenForo forum. This directory (`src/app/thinkpages`) is the App Router surface. The forum home is `/thinkpages`.

The persona feed that used to share the ThinkPages name now lives on the Dashboard: the feed, the Accounts section (personas), feed post pages, persona profiles and saved posts. See `src/app/dashboard/README.md`. The feed's components are still in `src/components/thinkpages/` (`src/components/thinkpages/README.md`) and its tRPC router is `api.thinkpages.*`.

In the sidebar, ThinkPages is a row under Home (`src/lib/navigation/app-sections.ts`, id `thinkpages`, href `FORUM_HOME`). The old XenForo bridge at `/forum` was retired in phase 4b, and phase 5 deleted its last redirects: `/forum/*` is a 404.

## Routes

| Route | File | Behaviour |
| --- | --- | --- |
| `/thinkpages` | `page.tsx` | Forum home: sitewide categories, the old forum's archive, and, for a realm member, a Your realm panel. Moderators see a Moderation button; members with a warning, ban or appeal on record see **Your standing** (`#standing`) |
| `/thinkpages/c/[key]` | `c/[key]/page.tsx` | A sitewide category's thread list |
| `/thinkpages/c/[key]/new` | `c/[key]/new/page.tsx` | Start a thread in a sitewide category |
| `/thinkpages/r/[realm]` | `r/[realm]/page.tsx` | A realm's landing page: its live board, the realm's boards beside it |
| `/thinkpages/r/[realm]/[key]` | `r/[realm]/[key]/page.tsx` | A realm category's thread list (the Hub and its categories) |
| `/thinkpages/r/[realm]/[key]/new` | `r/[realm]/[key]/new/page.tsx` | Start a thread in a realm category |
| `/thinkpages/t/[threadId]` | `t/[threadId]/(thread)/page.tsx` | Thread view with replies, reports and moderator tools |
| `/thinkpages/t/[threadId]/unread` | `t/[threadId]/unread/page.tsx` | Jump to unread: redirects (307) to the thread at the viewer's first unread post, or at its last post when they have read it all; a signed-out visitor gets the thread |
| `/thinkpages/mod` | `mod/page.tsx` | Moderation console for realm and category moderators and admins |
| `/thinkpages/post/[postId]` | `post/[postId]/page.tsx` | Post permalink resolver (wiki story chains link here). A forum post the viewer may see redirects (307) to `/thinkpages/t/<threadId>?page=<n>#post-<id>`; any other id redirects (307) to the feed post at `/dashboard/post/<id>`. The lookup runs as the session's viewer (Clerk `auth()` in the page, `locatePostFor` in `routers/thinkpagesForum/permalink.ts`), so a member's own report thread or a moderator's hidden post redirects on the server, to the page that viewer's thread view shows. Both hops are temporary because the answer depends on the viewer and on moderation |

No `loading.tsx` may sit above a redirecting page in this tree: a loading boundary turns `redirect()` into a streamed 200 with a meta refresh. `src/tests/architecture/wiki-loading-boundary.test.ts` pins this; loaders exist only below `c/`, `t/[threadId]/(thread)/`, `mod/` and `r/[realm]/[key]/`. The thread page's loader sits in the `(thread)` route group so that it does not wrap the unread redirect beside it.

## Forum

Reads and member writes go through `api.thinkpagesForum.*`; moderation (reports, hide/lock/pin/move, warnings, bans, appeals, the moderation log) goes through `api.thinkpagesForumMod.*`, surfaced in the moderation console at `/thinkpages/mod`. Logic lives in `src/server/modules/thinkpages-forum/`; the pure moderation rules (warning points, expiry, automatic ban thresholds) are in `src/lib/thinkpages-forum/moderation-policy.ts`. Every moderator action writes an append-only `ForumModLog` row in the same transaction.

Paths are built in `src/lib/thinkpages-forum/links.ts` (`FORUM_HOME`, `categoryHref`, `hubHref`, `threadHref`, `postHref`, `modHref`, `STANDING_HREF`). Pages and components use these helpers instead of spelling paths, so moving the home is a one-line change.

## Architecture

| Piece | Location |
| --- | --- |
| Pages | `src/app/thinkpages/` (this directory) |
| Components | `src/components/thinkpages-forum/` (`home/ForumHome`, `board/BoardPage`, `thread/ThreadPage`, `composer/` (Canvas and reply composers), `shell/ForumPage`, `RealmSwitcher`, `ForumComposer`, `ForumBreadcrumbs`, moderation console and dialogs under `mod/`) |
| Server logic | `src/server/modules/thinkpages-forum/` |
| tRPC routers | `src/server/api/routers/thinkpagesForum/` (`index.ts`, `mod.ts`, `viewer.ts`), registered in `root.ts` as `thinkpagesForum` and `thinkpagesForumMod` |
| Pure helpers | `src/lib/thinkpages-forum/` (`links.ts`, `permalink.ts`, `categories.ts`, `moderation-policy.ts`) |
| Layout and tint | `layout.tsx` sets `data-app="thinkpages"` (the Commons leather tint) for the subtree |

The old XenForo forum is copied in by the import described in `docs/operations/forum-xenforo-import-runbook.md` and `docs/systems/forum.md`.

## Connections

- **Dashboard `/dashboard`** — the persona feed, Accounts section, feed post, persona profile and saved pages (`src/app/dashboard/README.md`).
- **ThinkShare / `/messages`** — the messaging sub-system.
- **ThinkTanks `/thinktanks`** — group workspace.
- **Wiki** — story chains link to `/thinkpages/post/<id>`.
- **Stash** — threads are stashed as `thinkpages:thread:<id>` items.

## Reference

- Forum system doc: `docs/systems/forum.md`
- Feed and personas: `docs/systems/social.md`
- Feed component suite: `src/components/thinkpages/README.md`
- Routers: `src/server/api/routers/thinkpagesForum/` (forum) and `src/server/api/routers/thinkpages/` (feed and personas)
