# WikiOS operations

**For:** whoever runs the production server (`ssh ixwiki`). **Last updated:** 2026-10-27.

WikiOS v1 went live on production on 2026-10-26/27 (launch without takeover). The launch itself, step by step with its
backups, is history: [wikios-v1-cutover.md](../../history/operations/wikios-v1-cutover.md). This page is the living
part: what runs, which files and variables hold it, how to watch it, the levers, and how to back each piece out. The
architecture is in [WIKIOS.md](WIKIOS.md).

Shorthand below: `IX=/ixwiki/public/projects/ixstats` (the checkout), and IxStates' PM2 app is `ixstats-web`.

## Live topology

- **WikiOS is the wiki inside IxStates**, at `https://beta.ixwiki.com/wiki/…` (IxStates on port 3550, `BASE_PATH=""`).
  The old `ixwiki.com/projects/ixstat(e)s/*` URLs 301 to beta.ixwiki.com.
- **Classic MediaWiki stays public and editable** at `https://ixwiki.com/wiki/*`; canonical links stay on classic.
- **Corpus.** Imported with `scripts/wikios-import-xml.ts` from a `dumpBackup --full` of classic. Namespace 112
  (Semantic MediaWiki pages) was left out: its content model is no longer registered on classic. The WikiOS step-1 SQL
  was run again after the import (see [manual migrations](../../../prisma/manual-migrations/README.md)).
- **Render engine.** MediaWiki answers WikiOS privately on `127.0.0.1:8081` (`action=parse&text=`), an nginx server in
  `/etc/nginx/conf.d/wikios-render-internal.conf` with `root /ixwiki/mediawiki/releases/1.45.1`. It serves only
  `api.php` and `load.php`. Every server-side call to MediaWiki goes through it, the mirror's bot login, edits, imports
  and uploads included, so its `client_max_body_size` is `16m`. PHP-FPM's `request_terminate_timeout` is `300s`.
- **Classic → WikiOS.** MediaWiki's save webhook posts to `http://127.0.0.1:3550/api/wiki/sync-webhook`, with the URL
  and secret in PHP-FPM's pool (`env[WIKIOS_WEBHOOK_URL]`, `env[WIKIOS_WEBHOOK_SECRET]`); `wiki-recentchanges` catches
  anything the webhook missed.
- **WikiOS → classic.** The mirror outbox, applied by `wiki-mirror` (and by an in-process run a save kicks) through
  the `WikiOSMirror` bot password (group `wikios-mirror`).
- **Editing on:** `WIKIOS_V1_ENABLED=true`. Bots use IxStates' `/w/api.php`.
- **Sister wikis:** interwiki prefixes `iiwiki` and `althistory` on classic, and `Template:Sister`.
- **Not running:** no `wikios` process, no nginx takeover, no `/classic/` article path (see [Deferred](#deferred-the-ixwikicom-takeover)).

## Environment variables and server-local files

IxStates and `ixstats-cron` both read `$IX/.env.production.local`. After changing it, restart both from the ecosystem
file (`pm2 restart ecosystem.config.cjs --only ixstats-web,ixstats-cron --update-env`, in `$IX`): a restart by name
keeps the environment PM2 stored.

| File | What it holds |
|------|---------------|
| `$IX/.env.production.local` | `WIKIOS_V1_ENABLED=true`; `WIKIOS_MEDIAWIKI_INTERNAL_URL=http://127.0.0.1:8081/api.php` (never `NEXT_PUBLIC_WIKIOS_STANDALONE`; `WIKIOS_MEDIAWIKI_API` absent or private); `WIKIOS_MEDIAWIKI_BOT_USER`, `WIKIOS_MEDIAWIKI_BOT_TOKEN`; `WIKIOS_API_SESSION_SECRET`; `WIKIOS_UPLOAD_DIR=/ixwiki/shared/wikios-uploads`; `WIKI_SYNC_WEBHOOK_SECRET` (the same value as PHP-FPM's `WIKIOS_WEBHOOK_SECRET`); `NEXT_PUBLIC_APP_URL=https://beta.ixwiki.com`; optionally `WIKIOS_IMPORT_MAX_BYTES`, `WIKIOS_PROOF_DIR` (once the weekly proof is on), `WIKIOS_TEMPLATESTYLES=0` (only when the lever is pulled) |
| `$IX/.env.production` | `BASE_PATH=""`, `NEXT_PUBLIC_BASE_PATH=""` |
| `$IX/ecosystem.config.cjs` | `CRON_ENABLED_JOBS` for `ixstats-cron` (below) |
| `/ixwiki/shared/wikios-uploads/` | staging directory (750) of uploads waiting for the mirror |
| `/ixwiki/config/LocalSettings.php` | `require_once` of the snippet; never a `WIKIOS_TAKEOVER` define |
| `/ixwiki/config/wikios-localsettings.php` | copy of the tracked `scripts/ops/mediawiki/wikios-localsettings.php` (mode 644) |
| `/etc/php/8.4/fpm/conf.d/99-wikios-import.ini` | `upload_max_filesize` and `post_max_size` 16M |
| `/etc/php/8.4/fpm/pool.d/www.conf` | `env[WIKIOS_WEBHOOK_SECRET]`, `env[WIKIOS_WEBHOOK_URL]`, `request_terminate_timeout = 300s`; mode 0640 root:root |
| `/etc/nginx/conf.d/wikios-render-internal.conf` | the render engine on `127.0.0.1:8081` (from `scripts/ops/nginx/wikios-render-internal.conf`) |
| `/etc/nginx/conf.d/wikios-images-headers.conf` and the `/images/` location of classic's site | uploaded PDF and SVG files are sent as downloads, `nosniff` |
| `/etc/ixwiki-defense.conf`, `/etc/fail2ban/jail.d/ixwiki-bots.conf` | the server's own addresses and `IxStats-Builder` whitelisted; per-IP limits raised for readers (below) |
| `/ixwiki/shared/bots/discord/.env` | the bots' MediaWiki API URL on IxStates' loopback `/w/api.php` |
| classic: `Template:Sister`, the `interwiki` rows `iiwiki` and `althistory`, `robots.txt` | sister links, and IxStates' rules in classic's `robots.txt` |

Never print or paste the secrets; generate replacements on the server (`openssl rand -hex 32`). Rotation is in
[credentials.md](../../operations/credentials.md).

## Cron jobs

`ixstats-cron` runs (2026-10-27) `db-backup,log-retention,wiki-recentchanges,wiki-mirror,wiki-render-stale,forum-render-stale`.
The job table is `src/server/cron/jobs.ts` ([events.md](../../reference/events.md#scheduled--batch-jobs)).

| Job | Does |
|-----|------|
| `wiki-recentchanges` | pulls classic's recent changes into WikiOS (what the webhook missed) |
| `wiki-mirror` | applies the outbox of WikiOS writes (saves, moves, deletes, protections, uploads) to classic. Its lock is shared with the in-process run a save kicks |
| `wiki-render-stale` | re-renders, two at a time, the articles a changed template, an import or a sanitizer change left stale |
| `forum-render-stale` | re-renders forum posts left with a fallback render or an older pipeline |
| `wikios-proof` | **not enabled yet.** The weekly gold proof against the live site ([wikios-proof](../../audits/wikios-proof/README.md)); turn it on, with `WIKIOS_PROOF_DIR=/ixwiki/private/logs/wikios-proof`, only after a launch proof has passed |

Add a job the way the [release guide](../../operations/release-guide.md#a7-cron-jobs) says: one per cycle, restart from
the file, read back the list.

## Monitoring

| Watch | How |
|-------|-----|
| IxStates | `pm2 logs ixstats-web --lines 200 --nostream`, `pm2 status ixstats-web` (restarts column), `pm2 jlist` RSS |
| `ixstats-cron` | `pm2 logs ixstats-cron --lines 500 --nostream \| grep -iE 'wiki-(mirror\|render-stale\|recentchanges)\|WikiOS:render'`; a job that throws is recorded in `CronRun`, shows in `/api/health` (`cron.<job>.lastStatus`) and is alerted to the admin webhook |
| Render engine | `ss -ltnp \| grep ':8081'` shows `127.0.0.1:8081` only; `curl -s 'http://127.0.0.1:8081/api.php?action=parse&text=%7B%7B%23expr%3A2%2B3%7D%7D&contentmodel=wikitext&format=json' \| head -c 300` renders `5`; `/index.php` answers 404 |
| Webhook | `pm2 logs ixstats-web --lines 500 --nostream \| grep 'wiki/sync-webhook'`. 401 means the two secrets differ, 503 means IxStates has none, 429 means more than 600 a minute |
| Mirror outbox, conflicts, quarantine | `/admin/wikios-settings`: MediaWiki Mirror Outbox (a job that fails eight times is dead), Inbound sync quarantine, Conflict log |
| nginx | `tail -f /var/log/nginx/error.log`; 5xx on beta: `awk '$9>=500' /var/log/nginx/beta.ixwiki.com-access.log \| tail` |
| Bot defense, fail2ban | `/usr/local/bin/ixwiki-bot-defense.sh status`, `tail -f /var/log/ixwiki-bot-defense.log`, `fail2ban-client status ixwiki-bots` (they read classic's `access.log` only; see below) |
| PHP-FPM watchdog | `tail -f /ixwiki/private/logs/php-fpm-watchdog.log` (it probes classic's `/wiki/Main_Page`, which stays MediaWiki) |
| Sister wikis | `pm2 logs ixstats-web` and `pm2 logs ixstats-cron`, through `grep -iE 'circuit (open\|closed)\|could not be reached'`. A breaker that opens and never closes means that wiki, or the server's route to it, is down |
| Deploys | a refused deploy prints the WikiOS proof check's `FAIL <check>: ...` lines and stops before its backup; an overridden one prints `WIKIOS PROOF OVERRIDDEN:` lines. `FAIL proof.lease` means the weekly proof is running |
| Disk | `df -h /` (PM2 logs under `/var/log/pm2/`, rotated at 50M x 5) |

The broader server checks are in [monitoring.md](../../operations/monitoring.md).

## Bot defense and fail2ban

The bot-defense daemon (`/usr/local/bin/ixwiki-bot-defense.sh`, `/etc/ixwiki-defense.conf`) and the fail2ban jail
`ixwiki-bots` both read `/var/log/nginx/access.log`. One cold load of a wiki page inside IxStates is a document plus
dozens of `_next` chunks, fonts and flag files, then tRPC batches and an IxTime refresh, so a reader who opens a few
articles in a minute can cross the default 60 per minute and be blocked at the Cloudflare edge. The launch therefore:

- whitelisted the server's own requests (127.0.0.1, ::1, its egress addresses, user agent `IxStats-Builder`) in the
  daemon and `ignoreip` in the three ixwiki jails;
- raised the daemon's per-IP limit to 240 and the `ixwiki-bots` `maxretry` by 4 (same `findtime`).

**Since the move to beta (2026-10-27) the readers' traffic is outside both.** beta.ixwiki.com's site logs to
`/var/log/nginx/beta.ixwiki.com-access.log` (its static locations log nothing), and maps.ixwiki.com to its own log; the
daemon (`LOG_FILE` in the script) and the three jails (`logpath`) read only `/var/log/nginx/access.log`, which is
classic's. So IxStates' readers cannot trip them, and a flood against beta is seen only by Cloudflare. The quiet-log
split of [cutover §10b](../../history/operations/wikios-v1-cutover.md#10b-bot-defense-and-fail2ban-room-for-ixstates-readers-before-step-6b)
is not needed. To bring beta under the daemon and fail2ban, add its log to them (a new `logpath` line per jail, and the
daemon's log source) and keep the raised limits.

A reader who was blocked: `fail2ban-client set ixwiki-bots unbanip <ip>`, and remove the IP under Cloudflare, Security,
WAF, Tools (IP Access Rules).

## Emergency lever: turn TemplateStyles off

Articles keep the `<style>` blocks MediaWiki's TemplateStyles writes, after the sanitizer scopes every selector under
`.mw-parser-output` and filters each declaration (`src/lib/utils/scope-template-styles.ts`). If a CSS bypass is ever
reported (a template's sheet styling the reader's chrome, hiding the page, or loading another host), switch the feature
off first, then fix it. With `WIKIOS_TEMPLATESTYLES=0` the sanitizer removes **every** `<style>` from article HTML. The
lever **fails closed**: only unset, empty, `1`, `true`, `on` and `yes` (any case) leave TemplateStyles on.

```bash
cp -a $IX/.env.production.local $IX/.env.production.local.backup-$(date +%Y%m%d%H%M)
( umask 077; printf '\nWIKIOS_TEMPLATESTYLES=0\n' >> $IX/.env.production.local )
( cd $IX && pm2 restart ecosystem.config.cjs --only ixstats-web,ixstats-cron --update-env )
curl -s "https://beta.ixwiki.com/wiki/<Title>" | grep -c 'data-mw-deduplicate'   # 0 once the lever is pulled
```

The setting is part of the sanitizer fingerprint every stored bundle carries (`RENDERER_VERSION`), so no purge is
needed: an outdated bundle is re-sanitized on read and re-rendered in the background, and `wiki-render-stale` works
through the rest. **Back on** (after the scoper is fixed and `bun run audit:template-styles` reports 0 violations and 0
non-idempotent outputs): delete the line or set it to `1`, restart both the same way, and check with the `curl` above.

## Conflicts and known limits

When WikiOS and classic both change a page (an edit, delete, move or undelete), the later save by its actual save time
wins on both wikis; a tie within the same second goes to classic. The overwritten editor gets an in-app notice (and a
Discord DM when linked) with "Restore my text", a note on their classic user talk page, and an edit-summary trail on the
winning revision. Each collision is one row of the Conflict log. The overwritten revision stays in both histories.

Known limits (none loses text; each can leave someone untold or a page needing a hand fix):

- **Two classic moves after one WikiOS move:** only the first is judged against the WikiOS move; the second mover is
  not told.
- **A talk note that cannot be delivered** (talk page deleted, or refusing the note or the DM failing for a day): the
  Conflict log says "Not delivered: …" and it is never retried. Tell the person by hand, with a link to the page history.
- **A same-millisecond tie** with a classic restore can leave the classic revision below the WikiOS one: "Resync page
  from classic" if the step is quarantined, otherwise revert to the classic revision in WikiOS.
- **A classic recreate quarantined after a WikiOS delete:** resync the page from classic before retrying the step.
- **A dead WikiOS move:** before requeueing, read classic's `Special:Log/move` for the page; after discarding one,
  classic keeps the old title and later edits mirror to that page (by page id). Move it by hand if both should match.

Every outbox and quarantine action (requeue, discard, retry, dismiss, resync) writes an admin audit log row.

## Rollback of the live pieces

Each line backs out one piece; take a copy of the file first (`cp -a <file> <file>.backup-$(date +%F)`).

- **Editing off:** turn the editing toggle off in `/admin/wikios-settings`, or remove `WIKIOS_V1_ENABLED=true` and
  restart both processes. The cron list stays, so the outbox keeps draining.
- **Webhook:** remove the two `env[WIKIOS_…]` lines from `/etc/php/8.4/fpm/pool.d/www.conf`, then
  `php-fpm8.4 -t && systemctl reload php8.4-fpm`. `wiki-recentchanges` still brings classic's edits over.
- **Render engine:** `rm /etc/nginx/conf.d/wikios-render-internal.conf && nginx -t && systemctl reload nginx`, and
  remove `WIKIOS_MEDIAWIKI_INTERNAL_URL` (WikiOS can then neither render nor mirror: switch editing off first).
- **Mirror account:** block `WikiOSMirror` on classic's `Special:Block`, or revoke its bot password on
  `Special:BotPasswords`.
- **MediaWiki snippet:** remove the `require_once` from `/ixwiki/config/LocalSettings.php`, then
  `php-fpm8.4 -t && systemctl reload php8.4-fpm`.
- **Cron jobs:** drop the job from `CRON_ENABLED_JOBS` and restart `ixstats-cron` from the file.
- **Bot defense limits:** restore the two files' backups, then `systemctl restart ixwiki-bot-defense && fail2ban-client reload`.
- **The whole release:** the [release guide's rollback](../../operations/release-guide.md#rollback).

## Deferred: the ixwiki.com takeover

**Not run, and not to be run as written.** The owner deferred the takeover on 2026-10-24: WikiOS replacing classic at
`ixwiki.com/wiki/*`, a standalone `wikios` process on `127.0.0.1:3560`, the nginx snippets in `scripts/ops/nginx/`
(`wikios-upstream.conf`, `wikios-proxy-params.conf`, `wikios-takeover.conf`), `deploy/wikios/`, `scripts/deploy-wikios.sh`,
`WIKIOS_TAKEOVER` in LocalSettings and classic moving to `/classic/`. The T-steps (T5 to T12) in
[the cutover runbook](../../history/operations/wikios-v1-cutover.md#deferred-the-ixwikicom-takeover-do-not-run) are the
record of what it needs; they were written against September 2026's code and the old `/projects/ixstates` base path,
so running any of them needs a new owner decision and a rewrite against the code of that day.
