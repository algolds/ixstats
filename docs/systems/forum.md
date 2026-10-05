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
- `src/server/modules/forum/lib/bbcode-transformer.ts` – BBCode to HTML parser
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

## Related Documentation

- [ThinkPages Suite](./social.md)
- [Halo Wayfinding & Contextual Overlay](./halo.md)
- [Route README](<../../src/app/(forum)/README.md>)
- [API Reference](../reference/api-complete.md)
