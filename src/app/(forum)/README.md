# IxForum

**Last updated:** September 2026

IxForum is the native community area of IxStats, a server-side bridge to a XenForo
forum hosted at `forum.ixwiki.com`. Forum data is fetched, cached, and BBCode-transformed
server-side via tRPC, then rendered inside the IxStats UI under the `(forum)` route group.
The UI carries a warm community **orange** glass accent (`src/styles/forum.css`).

> Status: in active integration. Read, write, stash, and account-linking paths are live.
> Moderation, XenForo alerts, and profile sync are **not exposed** (their procedures were removed
> as zero-caller code in plan 312); private messaging is delegated to ThinkShare (see Routes).

## Routes

All pages live under the `(forum)` route group. The shared layout
(`forum/layout.tsx`) imports `forum.css` and wraps children in `ForumContextProvider`
plus the Halo forum plugin (`ForumHalo`).

| Route | File | Purpose |
| --- | --- | --- |
| `/forum` | `forum/page.tsx` | Forum home — category / forum list |
| `/forum/[forumId]` | `forum/[forumId]/page.tsx` | Single forum with paginated thread list |
| `/forum/thread/[threadId]` | `forum/thread/[threadId]/page.tsx` | Thread view with posts |
| `/forum/new-thread` | `forum/new-thread/page.tsx` | New thread composer |
| `/forum/search` | `forum/search/page.tsx` | Full-text forum search |
| `/forum/members/[userId]` | `forum/members/[userId]/page.tsx` | Member profile |
| `/forum/bookmarks` | `forum/bookmarks/page.tsx` | Stashed (bookmarked) threads |
| `/forum/conversations` | `forum/conversations/page.tsx` | **Redirects to `/messages`** (ThinkShare) |
| `/forum/conversations/[id]` | `forum/conversations/[id]/page.tsx` | Redirect to ThinkShare conversation |

Embeddable forum user cards live in a separate route group:
`src/app/(widget)/forum/cards/[username]/` (base, `embed/`, `profile/` variants).

## Key features

| Feature | Notes |
| --- | --- |
| Boards & threads | Forums, thread lists, threads with paginated posts, member profiles |
| BBCode transformation | Server-side BBCode→HTML via `transformBBCode` (`src/server/modules/forum/lib/bbcode-transformer.ts`) |
| Caching | Per-type TTL cache layer (`cachedFetch` / `cacheKey` in `src/server/modules/forum/lib/cache.ts`) |
| Account linking (IxnayID) | Clerk users link a XenForo account by username via `api.ixnayid.linkForum` / `unlinkForum`; stored on `User.forumUserId` / `forumUsername`. `api.forum.getLinkStatus` reports the link |
| Stash bookmarks | Bookmark threads via the shared Stash system |
| Moderation | Not exposed in IxStats (moderate on XenForo directly) |
| Forum alerts | Not exposed; forum alerts are expected to route through the global notification system |
| Widget embeds | Iframe-embeddable forum user cards under `(widget)/forum/cards/` |
| Private messaging | Not native — `/forum/conversations*` redirects to ThinkShare at `/messages` |

## Architecture

- **Route group** `(forum)` → `ForumContextProvider` + `ForumHalo` (Halo plugin).
- **Components**: `src/components/forum/` — `reader/` (ForumCategoryCard, ThreadListItem,
  ThreadRenderer, PostCard, Breadcrumbs, Pagination), `composer/` (ThreadComposer,
  ReplyComposer), `shared/` (ForumContext, ForumLayout).
- **Bridge / services**: `src/server/modules/forum/` — `services/xenforo-service.ts`
  (XenForo REST client), `services/forum-bridge.ts`, `services/linked-user.ts` (`requireForumUser`),
  `services/xenforo-user-sync.ts` (`linkForumAccount`, `lookupForumUser`), `lib/bbcode-transformer.ts`, `lib/cache.ts`.
- **API routes**: `src/app/api/forum/attachment/[id]/route.ts` (attachment proxy),
  `src/app/api/forum/user-cards/route.ts`.
- **Request flow**: client calls `api.forum.*` → router resolves the user's linked XenForo
  ID (writes) → XenForo REST fetch → cache → BBCode→HTML + internal link rewriting →
  normalized response.

## Data sources

tRPC router `api.forum.*`, registered in `src/server/api/root.ts` and split by domain in
`src/server/api/routers/forum/` (`reading`, `writing`, `stash`, `account`, merged via
`mergeRouters`):

| Procedure | Type | Domain |
| --- | --- | --- |
| `getRecentThreads`, `getForums`, `getForum`, `getThread`, `getMember`, `searchForum` | query | reading (public) |
| `createThread`, `createPost`, `editPost`, `deletePost`, `reactToPost`, `markForumRead` | mutation | writing (linked account) |
| `stashThread`, `unstashThread`, `isThreadStashed`, `getStashedThreads` | mutation/query | stash (protected) |
| `getLinkStatus` | query | account (protected) |

Linking and unlinking live on the IxnayID router: `api.ixnayid.linkForum`, `api.ixnayid.unlinkForum`
(`src/server/api/routers/ixnayid/linking.ts`).

Env: `XENFORO_API_KEY` (required in production), `XENFORO_API_URL`
(optional, default `https://forum.ixwiki.com/api`).

## See also

- Full system guide: [`docs/systems/forum.md`](../../../docs/systems/forum.md)
- ThinkShare messaging: [`docs/systems/social.md`](../../../docs/systems/social.md)
