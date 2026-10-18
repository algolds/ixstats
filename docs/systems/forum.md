# 🗨️ ThinkPages Forum — Community Discourse

**Last updated:** 2026-10-17

**Route:** `/thinkpages/*` (forum home `/thinkpages`) | **Legacy:** none (`/forum/*` is a 404) | **Status:** Release Candidate

The community forum is native to IxStates: sitewide boards plus a section for every realm, with reports, moderation and an import of the old XenForo forum (forum.ixwiki.com). The XenForo bridge ("IxForum", the `/forum` app with its own tint, which proxied XenForo's REST API) was retired in ThinkPages forum phase 4b.

---

## Native forum

- **Routes:** `/thinkpages` (home), `/thinkpages/c/<key>` (sitewide category), `/thinkpages/r/<realm>` (realm landing page and live board), `/thinkpages/r/<realm>/<key>` (realm category), `/thinkpages/t/<threadId>` (thread), `/thinkpages/mod` (moderation console), `/thinkpages/post/<postId>` (post permalink; sends a forum post to its thread and a feed post to `/dashboard/post/<id>`).
- **Data:** `ForumCategory`, `ForumThread`, `ForumPost` and the moderation models in `prisma/schema/`. Sitewide categories are seeded; every realm has Hub, Character Threads and Current Events (`src/lib/thinkpages-forum/categories.ts`).
- **Code:** server in `src/server/modules/thinkpages-forum/` (reads, writes, access rules, realm access, moderation, stash, public reads), routers in `src/server/api/routers/thinkpagesForum/` (`index.ts`, `mod.ts`, `viewer.ts`), pure helpers in `src/lib/thinkpages-forum/`, components in `src/components/thinkpages-forum/`.
- **Access:** categories are `public`, `reporter_staff` (Reports: members see only their own threads) or `staff`; `postRole: "staff"` categories take threads and replies from site admins only. Realm sections follow realm visibility and posting needs a nation in the realm or realm moderation. Bans apply per site, realm or category.
- **Moderation:** warnings (points expire after 90 days; 5 active points mean a 7-day ban, 10 a 30-day ban), bans, reports, appeals (one per active warning or ban, reviewed by a different moderator) and a moderation log. Policy lives in `src/lib/thinkpages-forum/moderation-policy.ts`.
- **Stash:** threads are stashed natively as `thinkpages:thread:<id>` items (`stash.ts`). Older `forum:thread:<xenforoThreadId>` items from the bridge are left out of the listing; the XenForo import moves each to its native thread (whatever the thread's visibility: the listing decides what its owner may read), or deletes it when the thread was never imported (`import-stash-threads.ts`).
- **Elsewhere in the app:** the global activity feed and Trending list the newest public threads (`public-threads.ts`: not hidden, public category, site section or a published realm); the passport counts a member's own visible posts and threads (`member-activity.ts`, persona content left out).
- **Messaging:** ThinkShare conversations that came from XenForo (`source: "forum"`) keep their history and are read-only: the server refuses sends, edits, deletes and reactions in them.

---

## The old forum: import and legacy links

The old forum is copied in two steps, so the importer never talks to XenForo. The import can be re-run with a fresh export to pick up posts made since: only missing rows are added, so edits to already-imported XenForo posts, and title, lock or pin changes on imported threads, are not re-imported. The production run is described in [`docs/operations/forum-xenforo-import-runbook.md`](../operations/forum-xenforo-import-runbook.md).

1. **Export** a snapshot of the XenForo forum to a local directory: `bun run forum:export-xenforo` (reads `XENFORO_API_URL` / `XENFORO_API_KEY` from the environment; they are import tooling, not app settings).
2. **Import** the snapshot: `bun run db:import-xenforo-forum -- --snapshot DIR` is a dry run that prints a report; `--apply` writes. The import is idempotent by XenForo id, and a rerun attributes posts to accounts linked since.

Imported rows keep their XenForo ids (`xenforoThreadId`, `xenforoPostId`), the author's XenForo name (`importedAuthorName`) and original dates. A XenForo member resolves to an IxStats user only through `User.forumUserId` / `forumUsername`, which stay as the author map; everyone else keeps the old name with no account. Self-service forum account linking is retired: staff link a member who claims old posts in the admin users panel (**Old forum**: `admin.linkUserForum` / `unlinkUserForum`, `old-forum-accounts.ts`), which sets the columns and attributes that XenForo user's imported threads and posts at once (`relinkImportedAuthors`, scoped); unlinking hands them back to the old name. Both are audit-logged. Settings show the old account read-only. Threads land in a mapped category (an owner-reviewed node map, then title heuristics) or in a read-only archive category `xf-<nodeId>`, which the forum home groups under "From the old forum". Imported threads show "Imported from the old forum." on the thread page and an "Imported" tag in lists.

**Legacy `/forum/*` links** are gone (phase 5): the routes that resolved XenForo ids at request time are deleted, so `/forum/*` is a 404. `src/server/modules/thinkpages-forum/import-forum-links.ts` (`resolveForumRef`) and `src/lib/thinkpages-forum/import/forum-links.ts` resolve a XenForo thread, post, node or member id to its native page, public content only, for the import: after the threads are written, every apply points old forum links in imported posts (`forum.ixwiki.com` URLs, root-relative XenForo paths such as `/threads/x.12/`, and the bridge's `/forum/...` paths, anchors' `href` only) at the native page, through the run's node map. A link with nothing public to point at (hidden, staff-only, never imported, or an old page with no native counterpart) is unwrapped to its text, or kept for a later run while threads failed or the snapshot is partial (some forums only, `--nodes`, or exported with `--skip-failing`); native posts, posts with Canvas source and the stored plain text are untouched. The same apply points bridge-era notification links (`[/projects/ixstates]/forum/thread/<id>[#post-<id>]`) at the native post, else its thread, through the same public-only resolver, or at `/thinkpages` when nothing public is there (`import-notification-links.ts`); the current base path is kept and the old `/projects/ixstats` one dropped. XenForo action links (`PostActionLink.postSource = "xenforo"`) are remapped to native posts by the import; a story chain's wiki section leaves out any left on a XenForo post.

Importer code is in `src/lib/thinkpages-forum/import/`, `src/server/modules/thinkpages-forum/import-*.ts` and `scripts/migrations/`.

---

## Related Documentation

- [ThinkPages feed and personas](./social.md)
- [Halo Wayfinding & Contextual Overlay](./halo.md)
- [Native forum README](../../src/app/thinkpages/README.md)
- [API Reference](../reference/api-complete.md)
