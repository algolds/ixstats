# Forum XenForo import: production go-live runbook

Phase 4 of the ThinkPages forum (Concept B). Every step below is confirmed with the owner before it runs. Code: `scripts/migrations/export-xenforo-forum.ts`, `scripts/migrations/import-xenforo-forum.ts`, `scripts/forum-legacy-redirect` (see `scripts/README.md`); design: `docs/systems/forum.md`.


Every step is **CONFIRM-WITH-OWNER** before it runs: state the exact command, the target, the expected effect and the rollback; wait for a yes. Never print secrets (mask `DATABASE_URL`, never echo `XENFORO_API_KEY`). Execution's own Task 0 reads the server configuration named in step 1; this plan only says what to look for.

0. **Preconditions** (CONFIRM-WITH-OWNER). The phase 4 PR is merged into `rose-garden` and deployed to production by the release guide (`docs/operations/release-guide.md` A1-A5); on the VPS (`ssh ixwiki`, `/ixwiki/public/projects/ixstats`): `git log -1`, `bun run db:generate` done by the deploy; the phase 1-4 migration SQL files applied by hand (`docker exec -i ixstats-postgres psql -U postgres -d ixstats < prisma/migrations/<dir>/migration.sql`, A7) and checked: `SELECT count(*) FROM forum_categories WHERE scope='site'` = 7, `\d forum_categories` shows `forum_categories_site_key_unique`, `\d forum_posts` shows `authorUserId` nullable and `xenforoUserId`. Rollback: none needed (idempotent SQL).
1. **Locate credentials and configuration** (CONFIRM-WITH-OWNER, read-only). `XENFORO_API_KEY` / `XENFORO_API_URL` in `/ixwiki/public/projects/ixstats/.env.production.local` (`grep -c XENFORO .env.production.local`, never `cat`); the XenForo install from nginx (`grep -rl "forum.ixwiki.com" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/`, its `root`), its `src/config.php` for the database name only (`grep "'dbname'" …`, Q1 fallback), `internal_data/attachments` size (`du -sh`), the API key's scopes (`curl -s -H "XF-Api-Key: $KEY" $URL/index | jq '.key.scopes'`, run with the key in a variable, output shows scopes only), `df -h /` and `UPLOAD_DIR` (`grep -c UPLOAD_DIR .env.production.local`; `ls -ld "$UPLOAD_DIR"` or `public/images/uploads`). Record findings in the ledger (no values of secrets).
2. **Production database backup** (CONFIRM-WITH-OWNER). `bun run db:backup` on the VPS; note the dump name; copy it off-site (`scp ixwiki:/ixwiki/public/projects/ixstats/backups/<dump> .`). Rollback reference for steps 6 and 9.
3. **Export the snapshot** (CONFIRM-WITH-OWNER; reads XenForo only). On the VPS: `set -a; source .env.production.local; set +a; bun run forum:export-xenforo -- --out .forum-import/prod-$(date -u +%Y%m%d)` (resumable; rerun until it exits 0). Check totals against the XenForo Admin CP statistics (threads, posts, attachments). Rollback: delete the directory.
4. **Dry run on the clone** (CONFIRM-WITH-OWNER for the clone refresh, which replaces `ixstats_wv1`). Locally: `rsync -a ixwiki:/ixwiki/public/projects/ixstats/.forum-import/prod-<date>/ ./.forum-import/prod-<date>/`; refresh the clone from the step 2 dump (`pg_restore --clean --if-exists --no-owner -d ixstats_wv1` into the local `ixstats-postgres` container), re-run `plans/wikios-v1-tools/e2e-provision.sh`, apply the phase 4 SQL; `bun run db:import-xenforo-forum -- --snapshot .forum-import/prod-<date>` (dry run) → read the report with the owner: node table, authors, warnings (staff-like titles), attachments; write `.forum-import/node-map.json` from the owner's answers (realm forums, private forums → `visibility: "staff"`, forums to skip); dry run again with `--node-map`; then `--apply` on the clone, then `--apply` again (expect 0 created); browser check (section "After the tasks"). Rollback: `--rollback --yes` on the clone or re-restore.
5. **Dry run on production** (CONFIRM-WITH-OWNER; reads only). On the VPS: `scp .forum-import/node-map.json ixwiki:/ixwiki/public/projects/ixstats/.forum-import/`; `bun run db:import-xenforo-forum -- --snapshot .forum-import/prod-<date> --node-map .forum-import/node-map.json --report .forum-import/prod-dry.json`; compare totals with the clone's report (same snapshot, so they differ only in "already present" and author matches); free disk must exceed 2× the attachment bytes. Rollback: none (no writes).
6. **Apply on production** (CONFIRM-WITH-OWNER). Same command with `--apply --production`; run under `nohup … > .forum-import/apply.log 2>&1 &` and tail it; watch `df -h /`; expect one transaction per thread. When done, rerun the same command (expect 0 created) and run the verification queries: counts per category (`SELECT c.key, count(t.id) FROM forum_categories c LEFT JOIN forum_threads t ON t."categoryId"=c.id GROUP BY 1 ORDER BY 1`), `SELECT count(*) FROM forum_threads WHERE "xenforoThreadId" IS NOT NULL`, same for posts, posts with `hidden`, posts with null author vs linked, `SELECT count(*) FROM forum_posts p WHERE "xenforoPostId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM forum_threads t WHERE t.id=p."threadId")` = 0, `ls "$UPLOAD_DIR/forum" | wc -l` vs the report's copied count, and three sample thread URLs from the report. Rollback: `bun run db:import-xenforo-forum -- --snapshot … --rollback --yes --production` (imported rows and files only; prints the count of native replies that would go with them) or, if anything else looks wrong, `bun run db:restore -- <step-2 dump> --i-know-this-is-production --yes` with the web app and `ixstats-cron` stopped (deployment.md "Backups and restore").
7. **Verify in the browser on production** (CONFIRM-WITH-OWNER; reads only). Signed out and signed in as the owner: `/thinkpages/forum` shows the seeded categories then "From the old forum"; a mapped thread, an archive thread, a thread with an inline image attachment, a locked thread, a thread with quotes and a YouTube link; author names (linked user vs imported name); `/thinkpages/post/<native id>` permalink; a `visibility: "staff"` archive category is absent signed out; no page errors. Record in the ledger. Rollback: step 6's.
8. **Flip the `/forum/*` redirect** (CONFIRM-WITH-OWNER). On the VPS: `bun run forum:legacy-redirect -- on`; within 15 s `curl -sI https://ixwiki.com/projects/ixstates/forum/thread/<xfId>` returns 307 to `/projects/ixstates/thinkpages/t/<id>`, `/forum/12` to the category, `/forum` to `/thinkpages/forum`; stash links on `/stashes` land on native threads. Rollback: `-- off` (reaches every process within 15 s).
9. **forum.ixwiki.com read-only** (CONFIRM-WITH-OWNER; done in the XenForo Admin CP by the owner or by Claude with the owner watching). Q12: revoke posting rights for Registered and Unregistered; add the notice with the link to the native forum; verify by trying to reply as a non-staff test account; export the permission set first (Admin CP → Users → Permission analysis, screenshot) as the rollback reference. Rollback: restore the permissions.
9b. **Delta import** (CONFIRM-WITH-OWNER; added by the final review, I1). Right after step 9 holds (no member can post on forum.ixwiki.com any more): export again into a NEW `--out` directory (same command as step 3), dry-run it on production with the same node map (`--production`; only threads/posts missing from the database are planned), then `--apply --production`. This picks up everything posted between the step 3 export and the read-only switch. Limits to state to the owner: edits to XenForo posts already imported, and title/lock/pin changes to already-imported threads, are not re-imported. Keep EVERY snapshot directory until 4b; a rollback must use the latest snapshot (its attachment ids scope the asset/file deletes).
10. **Redirect forum.ixwiki.com** (CONFIRM-WITH-OWNER; after the read-only period from Q13). Back up the current server block (`cp /etc/nginx/sites-enabled/<forum>.conf /root/forum.conf.bak-<date>`); replace it with a block that keeps TLS and returns 301s per Q13 (`location ~ ^/threads/(?:[^/]*\.)?(\d+)` → `https://ixwiki.com/projects/ixstates/forum/thread/$1`, `^/posts/(\d+)` → `/forum/post/$1`, `^/forums/(?:[^/]*\.)?(\d+)` → `/forum/$1`, `location /` → `/thinkpages/forum`); `nginx -t`; `systemctl reload nginx`; test the four forms with `curl -sI`; wiki links to old threads now land on native threads. Rollback: restore the backup block and reload. XenForo itself stays installed (PHP-FPM pool may be disabled later; its database and `internal_data` are kept as the archive of record).
11. **Phase 4b** (CONFIRM-WITH-OWNER before the PR is opened and before it deploys): after 8-10 have held for the agreed period, implement Task 8, merge, deploy; then `bun run forum:legacy-redirect -- status` is obsolete: delete the `forum_legacy_redirect` row (`DELETE FROM "SystemConfig" WHERE key='forum_legacy_redirect'`); keep `XENFORO_*` in `.env.production.local` until XenForo is decommissioned (re-exports stay possible). Rollback: the release guide's rollback (the import data is untouched by 4b).
12. **Later, out of scope:** decommission XenForo (stop its PHP-FPM pool, archive its database dump and attachments off-site, remove the nginx block in favour of a DNS-level redirect). Not part of this plan; the owner schedules it.


### Runbook additions from the phase 4 reviews (binding)

- Step 0 also checks: `uploaded_assets` exists (PR #67 migration) and phase 3's `20261010120000_thinkpages_forum_moderation` plus phase 4's `20261011120000_thinkpages_forum_import` are applied; how `/images/uploads/*` is served (nginx `location` for `UPLOAD_DIR`) and whether it sets `Content-Security-Policy: sandbox` + `X-Content-Type-Options: nosniff`; whether PDFs open under that CSP (R2), else the owner chooses "omit".
- Before step 3: the VPS/egress IP is in `/etc/ixwiki-defense.conf` whitelist and fail2ban `ignoreip` (the export runs at 0.9 rps with UA `IxStats-ForumExport/1.0`; the defense blocks above 60 req/min/IP).
- Step 3 output must be checked against the 12 "Verify at the first read-only export" items listed under "Checks at the first export" below: permission context (super key + `api_bypass_permissions`, listed vs `discussion_count` per forum), `/index`, sticky handling, redirect threads, attachment endpoint/MIME/size, users 403 behaviour, `posts.jsonl` size (< 512 MiB guard).
- Production `DATABASE_URL` for the importer is a direct Postgres connection (port 5433), never pgbouncer transaction pooling. Every production run (dry run included) passes `--production`. The single-run lock was verified on the clone (same backend after 7 min idle, re-assert true).
- `--apply` refuses while `report.blocking` is non-empty or any node falls back to a default target (unless `--accept-defaults`, owner decision); the owner reviews the node map (realm targets count as public for asset visibility — check no draft realm is targeted).
- Rollback is a pre-go-live tool: turn the legacy redirect switch OFF before any rollback; rollback leaves native stash rows pointing at deleted threads and deletes public forum assets that native posts may reference since.




## Checks at the first export

XenForo API behaviour the export assumes but could not verify offline (from the Task 2 review). Check each against the first read-only export before importing.


1. **Request context.**
   - Without `XF-Api-User`, does the key see private forums and moderated threads and posts? Compare the `/nodes/` count with the Admin CP node list, and a forum's listed threads with `type_data.discussion_count`.
   - If the key acts as a guest, test `?api_bypass_permissions=1` (super key).
2. **`GET /index`** (no trailing slash): does it route? Is `key` shaped `{ type, user_id, allow_all_scopes, scopes }`? Is `type` exactly `"super"`?
3. **`/forums/{id}/threads?page=N&order=post_date&direction=asc`.**
   - Is `direction=asc` accepted?
   - Is `sticky[]` present on page 1 only?
   - Are stickies excluded from `threads[]` on every page?
   - Does the listed total equal `discussion_count`?
4. **Redirect threads.** Are `discussion_type: "redirect"` rows listed, and do they return zero posts?
5. **`/threads/{id}/posts?page=N&order=natural`.**
   - Are `Attachments` inline whenever `attach_count > 0`?
   - Which `message_state` values come back (`visible` / `moderated` / `deleted`)?
   - What status comes back for a deleted thread: 404 or 403?
6. **`Attachments[].content_type`.** Is it a MIME type, or the owning content type (`"post"`)? The bridge assumes a MIME type (`PostCard.tsx:88`), but that was never verified.
7. **`/attachments/{id}/data`.**
   - Does it exist, and does it return raw bytes with a MIME `Content-Type`?
   - Does it require `attachment:read`?
   - Which status comes back for a forbidden attachment versus a missing one?
   - Is the body length equal to `file_size`?
8. **`/users/{id}/`.** Are `is_staff`, `register_date` and `message_count` present? Which status comes back when the key lacks `user:read`?
9. **`pagination`.** Is it present on every listing response, with `last_page` at least 1 for an empty forum?
10. **`/nodes/`.** Do categories carry `type_data: []`? Are `LinkForum` and `Page` nodes included?
11. **Size.** What is the total size of `posts.jsonl` on the real forum?
12. **The server's bot defense.**
    - Is the VPS IP or 127.0.0.1 allowlisted in `/etc/ixwiki-defense.conf` and in fail2ban `ignoreip` for the `ixwiki-bots` jail?
    - Is the export's User-Agent `IxStats-ForumExport/1.0` caught by the static nginx bot list?
    - The export defaults to `--rps 0.9`; keep it at or below that unless the IP is allowlisted.

