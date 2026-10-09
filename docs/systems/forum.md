# 🗨️ IxForum App — Community Discourse

**Last updated:** 2026-09-30

**Parent App Suite:** IxForum (`IXFORUM_VERSION = 1.4` platform-inherited)  
**Subsystems:** XenForo Native Bridge, Category Boards, IxnayID account linking  
**Primary Action:** `DEBATE` | **Domain Accent:** Warm Orange (`#F97316` / `--color-orange-500`)  
**Route:** `/forum/*` (`(forum)` route group) | **Status:** Release Candidate — read, write, stash, and linking are live; moderation, alerts and native messaging are not exposed  

IxForum delivers native community deliberation and archival debate inside IxStates by proxying and transforming data from a XenForo instance to the Next.js App Router with unified Facet styling and single sign-on.

---

## Overview

- **XenForo REST API Proxy**: All forum requests route through server-side tRPC endpoints with caching.
- **BBCode Transformation**: Server-side BBCode $\to$ HTML parsing with fallback rendering.
- **Account Linking**: Clerk user accounts link to a XenForo account via **IxnayID** with proof: `api.ixnayid.startForumVerification` issues a short-lived code (HMAC over the user, the forum account and a 30-minute window; key `FORUM_VERIFICATION_SECRET`, falling back to `CRON_SECRET`), the player saves it in the Location or About field of their forum profile, and `confirmForumVerification` reads the profile through the XenForo API before linking (a proven owner takes the link over from an unproven holder). `unlinkForum` removes it. Stored on `User.forumUserId` / `forumUsername`. There is no XenForo single sign-on. `bun run audit:forum-links` lists existing links (read-only); links made before verification codes had no proof.
- **Shared Stash Integration**: Bookmark and save forum threads using the platform-wide Stash system.
- **Unified Messaging**: Private conversations route through ThinkShare (`/forum/conversations*` redirects to `/messages`).
- **Not exposed**: admin moderation, XenForo alerts, and account-sync procedures were removed as zero-caller code in plan 312.

---

## Key Files & Routers

### Backend Routers
- `src/server/api/routers/forum/` (`index.ts`, `reading.ts`, `writing.ts`, `stash.ts`, `account.ts`), merged with `mergeRouters`
- `src/server/api/routers/ixnayid/linking.ts` – forum account linking (`startForumVerification`, `confirmForumVerification`, `unlinkForum`); proof logic in `src/server/modules/forum/services/forum-link-verification.ts`

### Module & Services
- `src/lib/thinkpages-forum/import/bbcode.ts` – BBCode to HTML parser
- `src/server/modules/forum/lib/cache.ts` – Caching with per-content TTLs
- `src/server/modules/forum/services/xenforo-service.ts` – XenForo API client
- `src/server/modules/forum/services/xenforo-user-sync.ts`, `linked-user.ts` – account linking and linked-user resolution

### UI Components & Pages
- `src/app/(forum)/forum/page.tsx` – Forum category list
- `src/app/(forum)/forum/[forumId]/page.tsx` – Thread list
- `src/app/(forum)/forum/thread/[threadId]/page.tsx` – Thread detail with post feed
- `src/app/(forum)/forum/{new-thread,search,bookmarks,members/[userId]}/page.tsx` – composer, search, stashed threads, member profile
- `src/components/forum/` – Composers, post cards, category headers, breadcrumbs

---

## Native Forum (ThinkPages) and the XenForo Import

The community forum is moving from the XenForo bridge described above to a native forum inside ThinkPages. The bridge sections above stay accurate until phase 4b retires them; the native forum is the target.

- **Routes:** `/thinkpages` (home; `?realm=<slug>` opens a realm's section), `/thinkpages/c/<key>` (sitewide category), `/thinkpages/r/<realm>/<key>` (realm category), `/thinkpages/t/<threadId>` (thread), `/thinkpages/mod` (moderation console), `/thinkpages/post/<postId>` (post permalink; sends a forum post to its thread and a feed post to `/dashboard/post/<id>`). The earlier home `/thinkpages/forum` redirects (308) to `/thinkpages`.
- **Data:** `ForumCategory`, `ForumThread`, `ForumPost` and the moderation models in `prisma/schema/`. Sitewide categories are seeded; every realm has Hub, Character Threads and Current Events (`src/lib/thinkpages-forum/categories.ts`).
- **Code:** server in `src/server/modules/thinkpages-forum/` (reads, writes, access rules, realm access, moderation, stash), routers in `src/server/api/routers/thinkpagesForum/` (`index.ts`, `mod.ts`, `viewer.ts`), pure helpers in `src/lib/thinkpages-forum/`, components in `src/components/thinkpages-forum/`.
- **Access:** categories are `public`, `reporter_staff` (Reports: members see only their own threads) or `staff`; `postRole: "staff"` categories take threads and replies from site admins only. Realm sections follow realm visibility and posting needs a nation in the realm or realm moderation. Bans apply per site, realm or category.
- **Moderation:** warnings (points expire after 90 days; 5 active points mean a 7-day ban, 10 a 30-day ban), bans, reports, appeals (one per active warning or ban, reviewed by a different moderator) and a moderation log. Policy lives in `src/lib/thinkpages-forum/moderation-policy.ts`.
- **Stash:** threads are stashed natively as `thinkpages:thread:<id>` items (`stash.ts`).

### Importing the XenForo forum

The old forum is copied in two steps, so the importer never talks to XenForo. The import can be re-run with a fresh export to pick up posts made since: only missing rows are added, so edits to already-imported XenForo posts, and title, lock or pin changes on imported threads, are not re-imported.

1. **Export** a snapshot of the XenForo forum to a local directory: `bun run forum:export-xenforo`.
2. **Import** the snapshot: `bun run db:import-xenforo-forum -- --snapshot DIR` is a dry run that prints a report; `--apply` writes. The import is idempotent by XenForo id, and a rerun attributes posts to members who have linked since.

Imported rows keep their XenForo ids (`xenforoThreadId`, `xenforoPostId`), the author's XenForo name (`importedAuthorName`) and original dates. A XenForo member resolves to an IxStats user only through `User.forumUserId`; everyone else keeps the old name with no account. Threads land in a mapped category (an owner-reviewed node map, then title heuristics) or in a read-only archive category `xf-<nodeId>`, which the forum home groups under "From the old forum". Imported threads show "Imported from the old forum." on the thread page and an "Imported" tag in lists.

While the legacy switch is on (`bun run forum:legacy-redirect -- on|off|status`; off by default), old `/forum/*` URLs redirect to the matching native thread, post, category or member. While it is off, the bridge pages render as before.

Importer code is in `src/lib/thinkpages-forum/import/` and `scripts/migrations/`; the bridge (`src/server/modules/forum/`, `src/app/(forum)/`) is retired in phase 4b.

---

## Related Documentation

- [ThinkPages feed and personas](./social.md)
- [Halo Wayfinding & Contextual Overlay](./halo.md)
- [Route README](<../../src/app/(forum)/README.md>)
- [API Reference](../reference/api-complete.md)
