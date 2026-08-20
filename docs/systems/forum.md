# Forum Integration (IxForum)

**Last updated:** August 2026  
**Status:** Production Ready (Beta)  
**Hierarchy:** Integrated Product (inherits platform version `IXFORUM_VERSION = 1.3`). Wraps the XenForo REST bridge.

IxForum provides a native forum experience inside IxStates by proxying and transforming data from a XenForo instance (`forum.ixwiki.com`) to the `/forum` route.

---

## Overview

- **XenForo REST API Proxy**: All forum requests route through server-side tRPC endpoints with caching.
- **BBCode Transformation**: Server-side BBCode $\to$ HTML parsing with fallback rendering.
- **Account Linking & SSO**: Clerk user accounts link to XenForo accounts via **IxnayID**.
- **Shared Stash Integration**: Bookmark and save forum threads using the platform-wide Stash system.
- **Unified Messaging**: Private conversations route through ThinkShare.

---

## Key Files & Routers

### Backend Routers
- `src/server/api/routers/forum/` (`index.ts`, `threads.ts`, `posts.ts`, `categories.ts`, `accounts.ts`, `stash.ts`)
- `src/server/api/routers/ixnayid.ts` – SSO identity bridge

### Module & Services
- `src/modules/forum/lib/bbcode-transformer.ts` – BBCode to HTML parser
- `src/modules/forum/lib/cache.ts` – Multi-tier caching with per-content TTLs
- `src/modules/forum/services/xenforo-service.ts` – XenForo API client

### UI Components & Pages
- `src/app/(forum)/forum/page.tsx` – Forum category list
- `src/app/(forum)/forum/[forumId]/page.tsx` – Thread list
- `src/app/(forum)/forum/thread/[threadId]/page.tsx` – Thread detail with post feed
- `src/components/forum/` – Composers, post cards, category headers, breadcrumbs

---

## Related Documentation

- [Social & Collaboration System](./social.md)
- [Halo Plugin System](./dynamic-island.md)
- [API Reference: Forum Router](../reference/api-complete.md#forum-router)
