# Forum Integration (XenForo)

**Last updated:** May 2026

**Hierarchy:** IxForum is the integrated product wrapping the XenForo forum bridge.

IxStates (IxStats) integrates a native XenForo forum experience via server-side API proxying. The forum is hosted at `forum.ixwiki.com` and rendered within the IxStats UI at `/forum`. BBCode content is transformed server-side, internal links are rewritten to IxStats routes, and user accounts are linked between Clerk and XenForo.

## Overview

| Feature | Description |
| --- | --- |
| XenForo REST API proxy | All forum data fetched server-side via tRPC, transformed, and cached |
| BBCode transformation | Server-side BBCode→HTML conversion with XenForo fallback rendering |
| Account linking | Clerk users link to XenForo accounts via IxnayID |
| Thread & post CRUD | Create threads, reply, edit, delete — all proxied through XenForo |
| Forum search | Full-text search across threads and posts |
| Stash bookmarks | Stash forum threads using the shared Stash system |
| Conversation system | Private messages routed through ThinkShare (unified messaging) |
| Widget embeds | Embeddable forum cards for user profiles |

## Key Files

### Router
| File | Purpose |
| --- | --- |
| `src/server/api/routers/forum.ts` | 1,186-line tRPC router (primary forum API surface) |

### Module
| File | Purpose |
| --- | --- |
| `src/modules/forum/index.ts` | Module barrel export |
| `src/modules/forum/lib/bbcode-transformer.ts` | BBCode→HTML transformation |
| `src/modules/forum/lib/cache.ts` | Forum-specific cache layer |
| `src/modules/forum/lib/forum-widget-utils.ts` | Widget rendering utilities |
| `src/modules/forum/services/forum-bridge.ts` | Forum↔IxStats bridge service |
| `src/modules/forum/services/bridge-types.ts` | Bridge type definitions |
| `src/modules/forum/services/xenforo-service.ts` | XenForo API client |
| `src/modules/forum/services/xenforo-user-sync.ts` | User synchronization service |

### Components
| File | Purpose |
| --- | --- |
| `src/components/forum/reader/ForumCategoryCard.tsx` | Forum category display |
| `src/components/forum/reader/ThreadListItem.tsx` | Thread list entry |
| `src/components/forum/reader/ThreadRenderer.tsx` | Full thread view with posts |
| `src/components/forum/reader/PostCard.tsx` | Individual post card |
| `src/components/forum/reader/Breadcrumbs.tsx` | Navigation breadcrumbs |
| `src/components/forum/reader/Pagination.tsx` | Pagination controls |
| `src/components/forum/composer/ThreadComposer.tsx` | New thread creation form |
| `src/components/forum/composer/ReplyComposer.tsx` | Reply composition form |
| `src/components/forum/shared/ForumContext.tsx` | Forum context provider |
| `src/components/forum/shared/ForumLayout.tsx` | Forum layout wrapper |

### Pages
| File | Purpose |
| --- | --- |
| `src/app/(forum)/forum/page.tsx` | Forum home (category list) |
| `src/app/(forum)/forum/[forumId]/page.tsx` | Single forum with thread list |
| `src/app/(forum)/forum/thread/[threadId]/page.tsx` | Thread view with posts |
| `src/app/(forum)/forum/new-thread/page.tsx` | New thread creation |
| `src/app/(forum)/forum/search/page.tsx` | Forum search |
| `src/app/(forum)/forum/conversations/page.tsx` | Conversations list |
| `src/app/(forum)/forum/conversations/[id]/page.tsx` | Single conversation |
| `src/app/(forum)/forum/members/[userId]/page.tsx` | Member profile |
| `src/app/(forum)/forum/bookmarks/page.tsx` | Stashed threads |

### Widget Embeds
| File | Purpose |
| --- | --- |
| `src/app/(widget)/forum/cards/[username]/page.tsx` | Embeddable forum user card |
| `src/app/(widget)/forum/cards/[username]/embed/page.tsx` | Iframe embed variant |
| `src/app/(widget)/forum/cards/[username]/profile/page.tsx` | Profile embed |

### API Routes
| File | Purpose |
| --- | --- |
| `src/app/api/forum/attachment/[id]/route.ts` | Attachment proxy |
| `src/app/api/forum/user-cards/route.ts` | User card API |

### Bridge
| File | Purpose |
| --- | --- |
| `src/server/bridges/forum-bridge.ts` | Server-side forum bridge |

### Styling
| File | Purpose |
| --- | --- |
| `src/styles/forum.css` | Forum-specific CSS (quote blocks, code blocks, images) |

## API Procedures

### Read Endpoints (Public)
| Procedure | Type | Description |
| --- | --- | --- |
| `getRecentThreads` | query | Recent threads across all forums with sorting |
| `getForums` | query | All forum categories and sub-forums |
| `getForum` | query | Single forum with paginated thread list |
| `getThread` | query | Thread with paginated posts (BBCode transformed) |
| `getPost` | query | Single post |
| `getMember` | query | Member profile with stats |
| `searchForum` | query | Full-text search across threads and posts |

### Stash Endpoints (Protected)
| Procedure | Type | Description |
| --- | --- | --- |
| `stashThread` | mutation | Bookmark a thread to Stash |
| `unstashThread` | mutation | Remove a thread from Stash |
| `isThreadStashed` | query | Check if a thread is bookmarked |
| `getStashedThreads` | query | List all bookmarked threads |

### Write Endpoints (Protected, requires linked account)
| Procedure | Type | Description |
| --- | --- | --- |
| `createThread` | mutation | Create a new forum thread |
| `createPost` | mutation | Reply to a thread |
| `editPost` | mutation | Edit an existing post |
| `deletePost` | mutation | Delete a post |
| `reactToPost` | mutation | Add/remove reactions |
| `getConversations` | query | List private conversations |
| `getConversation` | query | Single conversation with messages |
| `createConversation` | mutation | Start a private conversation |
| `replyToConversation` | mutation | Reply to a conversation |
| `uploadAttachment` | mutation | Upload a file attachment |

### Admin Endpoints
| Procedure | Type | Description |
| --- | --- | --- |
| `setupCustomFields` | mutation | Configure XenForo custom fields |
| `getForumStats` | query | Forum usage statistics |

### Account Linking
| Procedure | Type | Description |
| --- | --- | --- |
| `linkAccount` | mutation | Link Clerk user to XenForo account |
| `unlinkAccount` | mutation | Unlink forum account |
| `getLinkedAccount` | query | Get linked XenForo account info |
| `syncProfile` | mutation | Sync IxStats profile data to XenForo |

## Architecture

### Request Flow
1. Client calls `api.forum.*` tRPC procedure
2. Router resolves user's linked XenForo ID (if write operation)
3. Server fetches from XenForo REST API (`forum.ixwiki.com/api/`)
4. Response is cached (configurable TTL per content type)
5. BBCode is transformed to HTML; internal links are rewritten to `/forum/*` routes
6. Normalized response returned to client

### Caching Strategy
The forum uses a dedicated cache layer with per-type TTLs:
- `forums` (category list): longer TTL
- `threadList`: medium TTL, invalidated on thread creation
- `thread` / `post`: short TTL, invalidated on reply/edit
- `search`: short TTL
- `member`: medium TTL

### Link Rewriting
XenForo HTML is post-processed to rewrite internal URLs:
- `/threads/slug.123/` → `/forum/thread/123`
- `/forums/slug.123/` → `/forum/123`
- `/members/name.123/` → `/forum/members/123`
- `/posts/123/` → `#post-123` (in-page anchor)
- Attachment URLs remain external with `target="_blank"`

### Image Handling
- `referrerpolicy="no-referrer"` added to prevent hotlink blocking
- `loading="lazy"` and `decoding="async"` for performance
- Relative `/data/` paths rewritten to `https://forum.ixwiki.com/data/`

## Environment Variables
| Variable | Required | Description |
| --- | --- | --- |
| `XENFORO_API_KEY` | Yes (production) | XenForo super-admin API key |
| `XENFORO_API_URL` | Optional | Override XenForo base URL (default: `https://forum.ixwiki.com/api`) |

## Related Documentation
- [`docs/systems/social.md`](social.md) — ThinkPages and ThinkShare (messaging integration)
- [`docs/systems/social.md`](social.md) — ThinkShare unified messaging backbone
- [`docs/reference/api-complete.md`](../reference/api-complete.md) — Full API catalog
