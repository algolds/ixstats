---
name: Forum Integration Initiative
description: Native XenForo forum integration into IxStats + IxnayID SSO planning (March 2026)
type: project
---

Native forum integration into IxStats following the WikiOS pattern. XenForo at forum.ixwiki.com remains the backend; IxStats provides the native frontend.

**Why:** Last major external service not natively integrated. Goal: unified experience across wiki, forum, and IxStats.

**How to apply:** 
- Forum uses `(forum)` route group at `src/app/(forum)/forum/`
- Components in `src/components/forum/` (shared/, reader/, composer/, profile/)
- Orange color theme (`#f97316`) — distinct from WikiOS blue
- BBCode transformer at `src/lib/forum/bbcode-transformer.ts`
- Forum cache at `src/lib/forum/cache.ts`
- tRPC router expanded from 5 to ~20 endpoints at `src/server/api/routers/forum.ts`
- XenForo service enhanced with per-user requests (XF-Api-User header) for write operations
- ForumContext feeds DynamicIsland ForumView
- Hybrid routing: file-based for pages, client-side for thread pagination/replies
- IxnayID SSO IMPLEMENTED: Clerk as hub, User model has wikiUsername/discordUserId/forumUserId
- IxnayID tRPC router at `src/server/api/routers/ixnayid.ts` (9 endpoints)
- Wiki linking via `src/lib/wiki-user-sync.ts` (uses wiki-bridge.ts direct MySQL)
- Discord linking via `src/lib/discord-user-sync.ts` (extracts from Clerk OAuth)
- IxnayIDCard component on profile page at `src/app/profile/_components/IxnayIDCard.tsx`
- Discord bot module at `shared/bots/discord/lib/ixnayid.js` (raw SQL lookups)
