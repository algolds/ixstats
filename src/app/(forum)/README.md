# IxForum

**Last updated:** October 2026

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
| `/forum/post/[postId]` | `forum/post/[postId]/page.tsx` | XenForo post permalinks (nginx sends `/posts/<id>/` here): the native post while the legacy switch is on, the bridge's forum home while it is off (the bridge has no post page) |

### Legacy redirect gate

Once the XenForo forum is imported into the native ThinkPages forum (phase 4), the old `/forum/*` links move with
it. Every gated page's server component first awaits `followLegacyRedirect(ref)` (`forum/legacy-gate.ts`), which
asks `legacyForumRedirectFor` (`src/server/modules/thinkpages-forum/legacy-redirect.ts`):

- **Switch on** (`SystemConfig` key `forum_legacy_redirect` is `"true"`, read with a 15 second cache): the page
  answers a **307** (temporary) to the native page. `/forum/thread/<xfId>` goes to `/thinkpages/t/<id>`,
  `/forum/post/<xfPostId>` to `/thinkpages/post/<id>`, `/forum/<nodeId>` to its category (from the applied node
  map), `/forum/members/<xfUserId>` to the linked member's profile, and the other pages (home, search, bookmarks,
  new thread) and any id with no public native match to `/thinkpages`. Targets are built from ids and known
  category keys only, so there is no open redirect.
- **Switch off**: the gate returns and the bridge page renders as before.

The switch is flipped with `bun run forum:legacy-redirect -- on|off` (`scripts/ops/forum-legacy-redirect.ts`; on
the production database it needs `--production`), as the import runbook
(`docs/operations/forum-xenforo-import-runbook.md`) describes. The gate calls `connection()`, so gated pages are
always dynamic and the switch is never frozen into a prerendered page. `/forum/conversations*` is not gated: it
always redirects to ThinkShare.

**No `loading.tsx` in this route group, at any depth.** A `loading.tsx` wraps the page in a Suspense boundary, so
Next.js starts streaming a 200 before the page runs; a `redirect()` thrown after that point becomes a client-side
meta refresh instead of a real 307 (seen on the clone with a switched-on `/forum/thread/<id>`). Search engines and
the nginx rules for old XenForo URLs need the real status code. The forum layouts add no Suspense boundary either;
a bridge page that needs a fallback puts its `<Suspense>` inside its `*Client.tsx`, below the gate.
`src/tests/architecture/wiki-loading-boundary.test.ts` enforces both.

Embeddable forum user cards live in a separate route group:
`src/app/(widget)/forum/cards/[username]/` (base, `embed/`, `profile/` variants).

## Key features

| Feature | Notes |
| --- | --- |
| Boards & threads | Forums, thread lists, threads with paginated posts, member profiles |
| BBCode transformation | Server-side BBCode→HTML via `transformBBCode` (`src/lib/thinkpages-forum/import/bbcode.ts`) |
| Caching | Per-type TTL cache layer (`cachedFetch` / `cacheKey` in `src/server/modules/forum/lib/cache.ts`) |
| Account linking (IxnayID) | Users prove they own a XenForo account by putting a code on their forum profile (`api.ixnayid.startForumVerification` / `confirmForumVerification`; `unlinkForum` removes it); stored on `User.forumUserId` / `forumUsername`. `api.forum.getLinkStatus` reports the link |
| Stash bookmarks | Bookmark threads via the shared Stash system |
| Moderation | XenForo only (decision D12): no report or moderator tools in IxStats; the help article `src/content/help/social/forum.md` says so |
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
  `services/xenforo-user-sync.ts` (`linkForumAccount`, `lookupForumUser`), `lib/cache.ts`; the BBCode transformer lives in
  `src/lib/thinkpages-forum/import/bbcode.ts` (shared with the phase 4 import).
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
