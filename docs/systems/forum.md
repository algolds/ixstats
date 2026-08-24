# 🗨️ IxForum App — Community Discourse

**Parent App Suite:** IxForum (`IXFORUM_VERSION = 1.4` platform-inherited)  
**Subsystems:** XenForo Native Bridge, Category Boards, Sovereign Dispatches, IxnayID SSO  
**Primary Action:** `DEBATE` | **Domain Accent:** Warm Orange (`#F97316` / `--color-orange-500`)  
**Route:** `/(forum)/forum` | **Status:** 📀 Gold Master (100% Ready)  

IxForum delivers native community deliberation and archival debate inside IxStates by proxying and transforming data from a XenForo instance to the Next.js App Router with unified Facet styling and single sign-on.

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

- [ThinkPages Suite](./social.md)
- [Halo Wayfinding & Contextual Overlay](./halo.md)
- [API Reference: Forum Router](../reference/api-complete.md#forum-router)
