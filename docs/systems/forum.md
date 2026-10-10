# 🗨️ ThinkPages Forum — Community Discourse

**Last updated:** 2026-10-09

**Route:** `/thinkpages/*` (forum home `/thinkpages`) | **Legacy:** `/forum/*` redirects only (308) | **Status:** Release Candidate

The community forum is native to IxStates: sitewide boards plus a section for every realm, with reports, moderation and an import of the old XenForo forum (forum.ixwiki.com). The XenForo bridge ("IxForum", the `/forum` app with its own tint, which proxied XenForo's REST API) was retired in ThinkPages forum phase 4b.

---

## Native forum

- **Routes:** `/thinkpages` (home; `?realm=<slug>` opens a realm's section), `/thinkpages/c/<key>` (sitewide category), `/thinkpages/r/<realm>/<key>` (realm category), `/thinkpages/t/<threadId>` (thread), `/thinkpages/mod` (moderation console), `/thinkpages/post/<postId>` (post permalink; sends a forum post to its thread and a feed post to `/dashboard/post/<id>`). The earlier home `/thinkpages/forum` redirects (308) to `/thinkpages`.
- **Data:** `ForumCategory`, `ForumThread`, `ForumPost` and the moderation models in `prisma/schema/`. Sitewide categories are seeded; every realm has Hub, Character Threads and Current Events (`src/lib/thinkpages-forum/categories.ts`).
- **Code:** server in `src/server/modules/thinkpages-forum/` (reads, writes, access rules, realm access, moderation, stash, public reads), routers in `src/server/api/routers/thinkpagesForum/` (`index.ts`, `mod.ts`, `viewer.ts`), pure helpers in `src/lib/thinkpages-forum/`, components in `src/components/thinkpages-forum/`.
- **Access:** categories are `public`, `reporter_staff` (Reports: members see only their own threads) or `staff`; `postRole: "staff"` categories take threads and replies from site admins only. Realm sections follow realm visibility and posting needs a nation in the realm or realm moderation. Bans apply per site, realm or category.
- **Moderation:** warnings (points expire after 90 days; 5 active points mean a 7-day ban, 10 a 30-day ban), bans, reports, appeals (one per active warning or ban, reviewed by a different moderator) and a moderation log. Policy lives in `src/lib/thinkpages-forum/moderation-policy.ts`.
- **Stash:** threads are stashed natively as `thinkpages:thread:<id>` items (`stash.ts`). Older `forum:thread:<id>` items from the bridge stay and open their old `/forum/thread/<id>` path, which redirects.
- **Elsewhere in the app:** the global activity feed and Trending list the newest public threads (`public-threads.ts`: not hidden, public category, site section or a published realm); old `forum.ixwiki.com/threads/…` links in wiki pages and posts preview the imported thread (`wikios.getForumThreadPreview`); the passport counts a member's own visible posts and threads (`member-activity.ts`, persona content left out).
- **Messaging:** ThinkShare conversations that came from XenForo (`source: "forum"`) keep their history and are read-only.

---

## The old forum: import and legacy links

The old forum is copied in two steps, so the importer never talks to XenForo. The import can be re-run with a fresh export to pick up posts made since: only missing rows are added, so edits to already-imported XenForo posts, and title, lock or pin changes on imported threads, are not re-imported. The production run is described in [`docs/operations/forum-xenforo-import-runbook.md`](../operations/forum-xenforo-import-runbook.md).

1. **Export** a snapshot of the XenForo forum to a local directory: `bun run forum:export-xenforo` (reads `XENFORO_API_URL` / `XENFORO_API_KEY` from the environment; they are import tooling, not app settings).
2. **Import** the snapshot: `bun run db:import-xenforo-forum -- --snapshot DIR` is a dry run that prints a report; `--apply` writes. The import is idempotent by XenForo id, and a rerun attributes posts to accounts linked since.

Imported rows keep their XenForo ids (`xenforoThreadId`, `xenforoPostId`), the author's XenForo name (`importedAuthorName`) and original dates. A XenForo member resolves to an IxStats user only through `User.forumUserId` / `forumUsername`, which stay as the author map; everyone else keeps the old name with no account. Self-service forum account linking is retired: staff link a member who claims old posts in the admin users panel (**Old forum**: `admin.linkUserForum` / `unlinkUserForum`, `old-forum-accounts.ts`), which sets the columns and attributes that XenForo user's imported threads and posts at once (`relinkImportedAuthors`, scoped); unlinking hands them back to the old name. Both are audit-logged. Settings show the old account read-only. Threads land in a mapped category (an owner-reviewed node map, then title heuristics) or in a read-only archive category `xf-<nodeId>`, which the forum home groups under "From the old forum". Imported threads show "Imported from the old forum." on the thread page and an "Imported" tag in lists.

**Legacy `/forum/*` links** answer a permanent redirect (308) through the import's id map: a thread, post, forum node or member goes to its native page, anything unknown or not public to the forum home. See [`src/app/(forum)/README.md`](<../../src/app/(forum)/README.md>). XenForo action links (`PostActionLink.postSource = "xenforo"`) are remapped to native posts by the import; any left point at `/forum/post/<id>`.

Importer code is in `src/lib/thinkpages-forum/import/`, `src/server/modules/thinkpages-forum/import-*.ts` and `scripts/migrations/`.

---

## Related Documentation

- [ThinkPages feed and personas](./social.md)
- [Halo Wayfinding & Contextual Overlay](./halo.md)
- [Legacy redirects README](<../../src/app/(forum)/README.md>)
- [Native forum README](../../src/app/thinkpages/README.md)
- [API Reference](../reference/api-complete.md)
