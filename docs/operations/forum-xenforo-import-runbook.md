# Forum XenForo import: production go-live runbook

Moves the community forum at forum.ixwiki.com (XenForo) into the native ThinkPages forum: export a snapshot, import it, make the old forum read-only, import what was posted meanwhile, then redirect old links. Scripts (see `scripts/README.md`): `bun run forum:export-xenforo` (`scripts/migrations/export-xenforo-forum.ts`), `bun run db:import-xenforo-forum` (`scripts/migrations/import-xenforo-forum.ts`), `bun run forum:legacy-redirect` (`scripts/ops/forum-legacy-redirect.ts`). Design: `docs/systems/forum.md`.

## Ground rules

- **Every step is confirmed with the owner before it runs**: state the exact command, the target, the expected effect and the rollback, then wait for a yes.
- **Every production command passes `--production`**, dry runs included. Without it the scripts refuse a database named `ixstats`. With it they load `.env.production.local`, so never `source` that file or `set -a` it into your shell.
- **Secrets never appear on screen or in `ps`**: no `cat` of env files, no API key on a command line. For manual API calls put the header in a file readable only by you (`umask 077; printf 'header = "XF-Api-Key: %s"\n' "$KEY" > ~/.xf-curl; curl --config ~/.xf-curl …; rm ~/.xf-curl`), with `$KEY` read from the env file in a subshell.
- **The importer needs a direct Postgres connection** (port 5433), never pgbouncer transaction pooling. Its single-run lock lives on one dedicated connection (verified to survive a long idle on the clone).
- **Keep every snapshot directory until phase 4b ships.** Rollback is a pre-go-live tool (see step 6).

## Steps

0. **Preconditions** (read-only).
   - Phases 1-4 are merged into `rose-garden` and deployed (`docs/operations/release-guide.md`). On the VPS (`ssh ixwiki`, `/ixwiki/public/projects/ixstats`): `git log -1` matches; the deploy ran `bun run db:generate`.
   - Hand-applied migrations (`docker exec -i ixstats-postgres psql -U postgres -d ixstats < prisma/migrations/<dir>/migration.sql`; all are idempotent): `20261008120000_thinkpages_forum`, `20261009120000_thinkpages_forum_realms`, `20261010030000_uploaded_assets`, `20261010120000_thinkpages_forum_moderation`, `20261011120000_thinkpages_forum_import`. Check: `SELECT count(*) FROM forum_categories WHERE scope='site'` = 7; `\d forum_posts` shows `authorUserId` nullable, `xenforoUserId`, and the `createdAt` index; `\d forum_threads` shows `importedAuthorName` and `xenforoUserId`; `\d uploaded_assets` shows `visibility`.
   - Uploads: how nginx serves `/images/uploads/*` (its `location` for `UPLOAD_DIR`), and whether that location sends `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff` (`curl -sI` an existing upload). Whether a PDF opens under that header; if not, either serve `/images/uploads/forum/*.pdf` with `Content-Disposition: attachment`, or the owner chooses to omit PDFs.
   - Disk: `df -h /`. Free space must cover the attachment bytes twice **plus** Postgres growth (table, indexes and WAL; budget at least 3× the size of the snapshot's `posts.jsonl`). A full root disk takes Postgres down (see the server CLAUDE.md).
1. **Locate configuration** (read-only). `grep -c XENFORO .env.production.local` (expect 2: URL and key); `grep -c UPLOAD_DIR .env.production.local`; the XenForo install (`grep -rl "forum.ixwiki.com" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/`); its `internal_data/attachments` size (`du -sh`); the API key's type and scopes (`curl --config ~/.xf-curl -s $URL/index | jq '.key | {type, scopes}'`). Record findings, never values of secrets.
2. **Back up production.** `bun run db:backup`; note the dump name; copy it off-site (`scp ixwiki:/ixwiki/public/projects/ixstats/backups/<dump> .`). This is the restore point for every later step.
3. **Export the snapshot** (reads XenForo only).
   - First: the VPS IP (or 127.0.0.1) is in the `/etc/ixwiki-defense.conf` whitelist and in fail2ban `ignoreip` for the `ixwiki-bots` jail. The export runs at 0.9 requests per second with User-Agent `IxStats-ForumExport/1.0`; the defense blocks above 60 requests per minute per IP.
   - `bun run forum:export-xenforo -- --production --out .forum-import/prod-$(date -u +%Y%m%d)`. It resumes; rerun until it exits 0.
   - Go through **Checks at the first export** below. Compare totals with the XenForo Admin CP statistics, and the per-forum listed thread counts the export prints with each forum's discussion count (fewer listed means the key did not see everything).
   - Rollback: delete the directory.
4. **Dry run on the clone.**
   - Locally: `rsync -a ixwiki:/ixwiki/public/projects/ixstats/.forum-import/prod-<date>/ ./.forum-import/prod-<date>/`; refresh the clone from the step 2 dump (`pg_restore --clean --if-exists --no-owner -d ixstats_wv1` into the local `ixstats-postgres` container), re-run `plans/wikios-v1-tools/e2e-provision.sh`, apply the migrations from step 0.
   - `bun run db:import-xenforo-forum -- --snapshot .forum-import/prod-<date>` and read the report with the owner: the node table (every node needs an explicit decision: target category, realm, staff-only archive, or skip), staff-like titles, authors, unknown states, attachments by reason, template-syntax and fallback counts.
   - Write `.forum-import/node-map.json` from the owner's answers. Every imported forum needs an entry: `--apply` refuses while any node is placed only by its title or by the default (unless `--accept-defaults`, an owner decision), while anything is listed under BLOCKING, or while the snapshot is incomplete. Private forums go to `visibility: "staff"` archives. Do not target a realm that is not published.
   - Dry run again with `--node-map`, then `--apply`, then `--apply` again (expect nothing created), then a signed-in browser check.
   - Rollback on the clone: `--rollback` (preview) then `--rollback --yes`, or restore again.
5. **Dry run on production** (reads only). `scp .forum-import/node-map.json ixwiki:/ixwiki/public/projects/ixstats/.forum-import/`; `bun run db:import-xenforo-forum -- --production --snapshot .forum-import/prod-<date> --node-map .forum-import/node-map.json --report .forum-import/prod-dry.json`. It prints the upload directory and the masked database it will use; check both. Totals must match the clone's report except "already present" and author matches.
6. **Apply on production.**
   - Same command with `--apply`, under `nohup … > .forum-import/apply.log 2>&1 &`; tail it; watch `df -h /`.
   - Exit codes: 0 done; 1 refused or failed (nothing past the failure point was written; per-thread failures are listed, and a rerun retries them); 2 done but some media-asset registrations failed (ids listed; a rerun retries the retryable ones).
   - Rerun the same command: expect nothing created.
   - Verify: counts per category (`SELECT c.key, count(t.id) FROM forum_categories c LEFT JOIN forum_threads t ON t."categoryId"=c.id GROUP BY 1 ORDER BY 1`); imported threads and posts (`… WHERE "xenforoThreadId" IS NOT NULL`, same for posts); hidden posts; null-author vs linked posts; no orphan posts; `ls "$UPLOAD_DIR/forum" | wc -l` against the report's copied count; three sample thread URLs from the report.
   - **Rollback** (only before step 8): `bun run db:import-xenforo-forum -- --production --snapshot … --rollback` prints what would be deleted (imported threads and posts, native replies on imported threads, archive categories, the node map row, forum media assets, copied files) without deleting. Then `--rollback --yes`. It refuses while the legacy redirect is on. It leaves stash items that point at deleted threads, and deletes forum images that native posts may have reused since, which is why it is a pre-go-live tool. For anything wider, restore the step 2 dump (`bun run db:restore -- <dump> --i-know-this-is-production --yes`, web app and `ixstats-cron` stopped; `docs/operations/deployment.md` "Backups and restore").
7. **Verify in the browser on production** (reads only). Signed out and as the owner: `/thinkpages/forum` shows the regular categories, then "From the old forum"; a mapped thread, an archive thread, a thread with an inline image, a locked thread, a thread with quotes and a YouTube link; author names (linked member vs imported name); `/thinkpages/post/<id>`; a staff-only archive is absent signed out; no page errors.
8. **Make forum.ixwiki.com read-only** (XenForo Admin CP, by the owner or with the owner watching). Export the permission set first (Admin CP → Users → Permission analysis, screenshot) as the rollback reference. For the Registered and Unregistered groups set "Post new thread", "Post replies", "Edit own posts", "Delete own posts", "Upload attachments", "Start conversations" and "React" to No; add a site notice linking to `https://ixwiki.com/projects/ixstates/thinkpages/forum`. Verify by trying to reply as a non-staff test account. Rollback: restore the permissions.
9. **Delta import**, right after step 8 holds (nobody can post on the old forum any more).
   - Export again into a NEW directory (step 3's command with a new `--out`), dry-run it on production with the same node map, then `--apply`. Only threads and posts missing from the database are created.
   - Content that was hidden or deleted on XenForo after the first export is hidden again here; the report counts it ("re-hidden"). Nothing is ever un-hidden or deleted by a delta.
   - Limits to tell the owner: edits to already-imported XenForo posts, and title, lock or pin changes to already-imported threads, are not carried over.
10. **Turn on the `/forum/*` redirects.** `bun run forum:legacy-redirect -- --production on`. Within 15 seconds: `curl -sI https://ixwiki.com/projects/ixstates/forum/thread/<xfId>` returns 307 to the native thread, `/forum/<nodeId>` to its category, `/forum` to `/thinkpages/forum`; hidden or staff content goes to the forum home; stash links on `/stashes` open native threads. Rollback: `bun run forum:legacy-redirect -- --production off` (takes effect within 15 seconds).
11. **Redirect forum.ixwiki.com** (after the read-only period the owner chooses). Back up the server block (`cp /etc/nginx/sites-enabled/<forum>.conf /root/forum.conf.bak-<date>`); replace it with a block that keeps TLS and returns 301s: `location ~ ^/threads/(?:[^/]*\.)?(\d+)` → `https://ixwiki.com/projects/ixstates/forum/thread/$1`, `^/posts/(\d+)` → `/forum/post/$1`, `^/forums/(?:[^/]*\.)?(\d+)` → `/forum/$1`, `location /` → `/thinkpages/forum`; `nginx -t`; `systemctl reload nginx`; test the four forms with `curl -sI`. Rollback: restore the backup block and reload. XenForo stays installed; its database and `internal_data` are the archive of record.
12. **Phase 4b** (its own PR, after 10 and 11 have held for the agreed period): delete the bridge, repoint the activity feed, trending and passport at the native forum, retire forum account linking. Afterwards delete the `forum_legacy_redirect` setting (`DELETE FROM "SystemConfig" WHERE key='forum_legacy_redirect'`; 4b makes the redirect permanent). Keep `XENFORO_*` in `.env.production.local` until XenForo is decommissioned.
13. **Later, out of scope:** decommission XenForo (stop its PHP-FPM pool, archive its database dump and attachments off-site, replace the nginx block with a DNS-level redirect). The owner schedules it.

## Known limitations

- Restricted forum images and all PDFs are static files under unguessable (content-hashed) names; "restricted" keeps them out of the image repository's listing, it does not put them behind a login.
- Hiding an imported post natively after the import does not change its image's visibility; only a re-run of the import does.

## Checks at the first export

XenForo API behaviour the export assumes but could not verify offline. Check each against the first export, before importing.

1. **Request context.** Without `XF-Api-User`, does the key see private forums and moderated threads and posts? Compare the `/nodes/` count with the Admin CP node list, and a forum's listed threads with its `type_data.discussion_count`. If the key acts as a guest, check that `api_bypass_permissions=1` (sent automatically for a super key) fixes it.
2. **`GET /index`** (no trailing slash): does it route? Is `key` shaped `{ type, user_id, allow_all_scopes, scopes }`, and is `type` exactly `"super"`?
3. **`/forums/{id}/threads?page=N&order=post_date&direction=asc`.** Is `direction=asc` accepted? Is `sticky[]` present on page 1 only? Are stickies excluded from `threads[]` on every page? Does the listed total equal `discussion_count`?
4. **Redirect threads.** Are `discussion_type: "redirect"` rows listed, and do they return zero posts?
5. **`/threads/{id}/posts?page=N&order=natural`.** Are `Attachments` inline whenever `attach_count > 0`? Which `message_state` values come back (`visible`, `moderated`, `deleted`)? What status does a deleted thread return, 404 or 403?
6. **`Attachments[].content_type`.** A MIME type, or the owning content type (`"post"`)?
7. **`/attachments/{id}/data`.** Does it return raw bytes with a MIME `Content-Type`? Does it need the `attachment:read` scope? Which status does a forbidden attachment return versus a missing one? Is the body length equal to `file_size`?
8. **`/users/{id}/`.** Are `is_staff`, `register_date` and `message_count` present? Which status comes back when the key lacks `user:read`?
9. **`pagination`.** Present on every listing, with `last_page` at least 1 for an empty forum?
10. **`/nodes/`.** Do categories carry `type_data: []`? Are `LinkForum` and `Page` nodes included?
11. **Size.** How large is `posts.jsonl`? The importer reads each snapshot file whole and refuses files over 512 MiB; the VPS has 8 GB of RAM shared with the app.
12. **Bot defense.** Is the VPS IP allowlisted (step 3)? Does the static nginx bot list catch `IxStats-ForumExport/1.0`? Keep `--rps` at 0.9 or below unless allowlisted.
