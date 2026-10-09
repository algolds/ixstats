# Legacy forum redirects (`/forum/*`)

**Last updated:** October 2026

The old XenForo bridge ("IxForum") was retired in ThinkPages forum phase 4b. Its forum was imported into the native
ThinkPages forum (`/thinkpages`, `src/app/thinkpages/`), and this route group now holds only redirects, so every
old `/forum/*` link, bookmark, stash item and nginx-forwarded `forum.ixwiki.com` URL keeps working.

## Routes

Every page is a server component that renders nothing: it awaits `followLegacyRedirect(ref)`
(`forum/legacy-gate.ts`), which answers a **308** (permanent, `permanentRedirect`) to the target from
`legacyForumRedirectFor` (`src/server/modules/thinkpages-forum/legacy-redirect.ts`).

| Route | Goes to |
| --- | --- |
| `/forum/thread/[threadId]` | the imported thread (`/thinkpages/t/<id>`, by `ForumThread.xenforoThreadId`) |
| `/forum/post/[postId]` | the imported post (`/thinkpages/post/<id>`, by `ForumPost.xenforoPostId`); nginx sends XenForo's `/posts/<id>/` here |
| `/forum/[forumId]` | the node's category from the applied node map (SystemConfig `forum_import_node_map`), else its archive category `xf-<nodeId>` |
| `/forum/members/[userId]` | the profile (`/@<handle>`) of the earliest account linked to that XenForo user (`User.forumUserId`) |
| `/forum`, `/forum/search`, `/forum/new-thread`, `/forum/bookmarks` | the forum home (`FORUM_HOME`) |
| `/forum/conversations`, `/forum/conversations/[id]` | ThinkShare (`/messages`, a plain redirect) |

Only what an anonymous visitor may read resolves: a thread or post that is not hidden, in a public category, in the
site section or a published realm. Anything else, an id that was never imported, a non-numeric id or a failed
lookup lands on the forum home, so walking the sequential XenForo ids tells nothing apart. Targets are built from
ids and known category keys only (`src/lib/thinkpages-forum/legacy-forum.ts`, `links.ts`), so there is no open
redirect. The gate calls `connection()`, so the pages are always dynamic while an import fills the id map.

**No `loading.tsx` and no layout in this route group, at any depth.** A `loading.tsx` wraps the page in a Suspense
boundary, so Next.js starts streaming a 200 before the page runs, and the redirect becomes a client-side meta
refresh instead of a real 308 (seen on the clone in phase 4). Search engines and the nginx rules for old XenForo
URLs need the real status code. `src/tests/architecture/wiki-loading-boundary.test.ts` enforces it.

## See also

- Native forum: [`src/app/thinkpages/README.md`](../thinkpages/README.md), [`docs/systems/forum.md`](../../../docs/systems/forum.md)
- The import: [`docs/operations/forum-xenforo-import-runbook.md`](../../../docs/operations/forum-xenforo-import-runbook.md)
