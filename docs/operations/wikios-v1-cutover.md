# WikiOS v1 cutover runbook

**Status:** nothing in this runbook has been applied. It is written for a human operator on the production server
(`ssh ixwiki`). Plan 417, September 30, 2026. It replaces the superseded
[Stage 3 config plan](../systems/wikios/wikios-stage3-config-plan.md).

**What changes.** WikiOS runs as its own Next.js process (`pm2` app `wikios`, `127.0.0.1:3560`, like IxWorld at
maps.ixwiki.com) and takes over `ixwiki.com/wiki/*`. Classic MediaWiki stays editable at
`ixwiki.com/classic/*` and `index.php?...action=edit`. MediaWiki also becomes a private render engine on
`127.0.0.1:8081` (`action=parse&text=`), and every saved MediaWiki page is announced to WikiOS by a webhook.
IxStates (port 3550) and IxWorld (port 3002) are untouched, apart from the brief degradation during the WikiOS
build described in step 5.

**Order matters.** Steps 0 to 7 change nothing the public can see (the canonical link MediaWiki emits after step 3
points at the URL it already serves). Step 8 is the cutover: nginx first, then one `LocalSettings.php` line. Every
step has a rollback line that names the backup it restores; step 12 is the full rollback.

Files shipped by plan 417 (all in the IxStats checkout, `/ixwiki/public/projects/ixstats/`):

| File | Installed as |
|------|--------------|
| `scripts/deploy-wikios.sh` | run in place |
| `deploy/wikios/ecosystem.wikios.config.cjs.example` | `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` |
| `deploy/wikios/next-config-snippet.md` | edits to the server-local `next.config.js` |
| `scripts/ops/nginx/wikios-render-internal.conf` | `/etc/nginx/conf.d/wikios-render-internal.conf` |
| `scripts/ops/nginx/wikios-upstream.conf` | `/etc/nginx/conf.d/wikios-upstream.conf` |
| `scripts/ops/nginx/wikios-proxy-params.conf` | `/etc/nginx/snippets/wikios-proxy-params.conf` |
| `scripts/ops/nginx/wikios-takeover.conf` | `/etc/nginx/snippets/wikios-takeover.conf` |
| `scripts/ops/mediawiki/wikios-localsettings.php` | `/ixwiki/config/wikios-localsettings.php` |
| `scripts/ops/verify-wikios-takeover.ts` | run in place with `bun` |

## Conventions (read once)

- **Shell setup.** Paste this at the top of every new shell before any step. It defines absolute paths only: no step
  changes directory without a subshell `( cd ...; ... )`, so a pasted block never leaves you somewhere else.

  ```bash
  IX=/ixwiki/public/projects/ixstats                          # the IxStats checkout
  WK=/ixwiki/public/wikios                                    # the WikiOS deploy directory
  MW=/ixwiki/mediawiki/releases/1.45.1                        # the MediaWiki install (adjust if it differs)
  BK=$(cat /ixwiki/private/backups/wikios-cutover.latest)     # the backup directory created in step 0
  IXSTATES_URL=$(sed -n 's/^NEXT_PUBLIC_IXSTATES_URL=//p' "$WK/.env.wikios-build" 2>/dev/null)   # empty until step 5
  # MediaWiki maintenance scripts run as the web user and read the production settings file:
  mwmaint() { sudo -u www-data env MW_CONFIG_FILE=/ixwiki/config/LocalSettings.php php "$MW/maintenance/run.php" "$@"; }
  # keep a copy of a file in $BK under a given name before editing it:  bk <file> <name>
  bk() { sudo cp -a "$1" "$BK/$2" && ls -l "$BK/$2"; }
  ```

  Step 0 creates `$BK`, so it skips the `BK=` line (it fails on the first run) and sets `BK` itself.
- **Backups.** Every file a step edits is copied into `$BK` first (`bk <file> <name>`), and the step's rollback line
  restores from there. `$BK` is mode 0700 because it holds copies of env files.
- **Secrets.** Never `echo` or paste a secret. Generate into a variable or a 0600 file inside a subshell with its own
  `umask` (`( umask 077; ... )`), and keep secrets out of command lines: `ps` shows every argument.
- **Reloads are chained.** `sudo nginx -t && sudo systemctl reload nginx` and
  `sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm` are always one command with `&&`: never reload a
  configuration that failed its test.
- **`sudoedit` refuses symlinks.** `/etc/nginx/sites-enabled/ixwiki.com` is one: edit its target,
  `sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"`.

## 0. Baseline and backup directory

```bash
IX=/ixwiki/public/projects/ixstats
git -C "$IX" log -1 --oneline   # the release that contains plan 417 and the WikiOS plans it depends on
df -h /                         # need several GB free: a full root disk takes Postgres down

TS=$(date +%Y%m%d-%H%M%S)
BK=/ixwiki/private/backups/wikios-cutover-$TS
install -d -m 700 "$BK" && echo "$BK" > /ixwiki/private/backups/wikios-cutover.latest
mkdir -p /ixwiki/private/logs/wikios-cutover
{
  date -Is
  echo "--- php-fpm pool RSS (MB):"
  ps -C php-fpm8.4 -o rss= | awk '{s+=$1} END {printf "%.0f\n", s/1024}'
  echo "--- free -m:";  free -m
  echo "--- uptime:";   uptime
  echo "--- pm2:";      pm2 jlist | jq -r '.[] | "\(.name) rss=\((.monit.memory/1048576)|floor)MB cpu=\(.monit.cpu)%"'
  echo "--- wiki page timing:"
  curl -s -o /dev/null -w "Main_Page total: %{time_total}s\n" "https://ixwiki.com/wiki/Main_Page"
} | tee /ixwiki/private/logs/wikios-cutover/baseline.txt
```

The baseline is for step 11. **Rollback:** nothing changed.

## 1. Apply the WikiOS SQL migrations

The WikiOS plans add hand-written, idempotent SQL under `prisma/manual-migrations/`. Take a dump first, then apply
the files in filename order:

```bash
( cd "$IX" && bun run db:backup )                                   # aborts non-zero on failure; dump lands in backups/
ls "$IX"/prisma/manual-migrations/*wikios*.sql | sort               # review the list; read each file before applying
for f in $(ls "$IX"/prisma/manual-migrations/*wikios*.sql | sort); do
  echo "== $f"
  docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$f" || break
done
```

**Rollback:** the files are additive and idempotent, so the running app is unaffected if you stop here. To undo,
restore the dump taken above (`pg_restore` into a scratch database first; never `docker system prune`).

## 1b. Import the MediaWiki rights (plan 409), after checking who vouched for each wiki link

`scripts/wikios-import-rights.ts` copies MediaWiki group memberships, protections and blocks into WikiOS. A group or
block that names a wiki account passes to the IxStates user linked to that account **only if the link is trusted**:
`wiki_account_links."verifiedById"` is NULL (the account proved it owns the wiki account itself, with the token on its
wiki user page) or the id of a system owner. The column is new in step 1, so **every link that existed before it reads
as NULL, including the ones an administrator confirmed by hand**, and would inherit that wiki account's sysop or
bureaucrat rights. Fix that first:

```bash
# read-only: every verified ixwiki link (the ones an admin confirmed and the ones a player proved look alike here)
docker exec -i ixstats-postgres psql -U postgres -d ixstats -c \
  "select l.id, l.\"userId\", l.username, l.\"verifiedAt\", l.\"verifiedById\", l.\"mwRegisteredAt\"
     from wiki_account_links l
    where l.source = 'ixwiki' and l.\"verifiedAt\" is not null and l.token is null
    order by l.\"verifiedAt\""
```

For each link an administrator confirmed (ask the admins; the admin user screen lists who linked whom), record the
admin who did it, so the link is no longer taken for self-proven:

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 -c \
  "update wiki_account_links set \"verifiedById\" = '<the confirming admin user id>' where id = '<link id>'"
```

An administrator who is not a system owner keeps the link untrusted (it inherits no imported rights by name, which is
the safe default); a system owner's id makes it trusted. Leave NULL only for links the player proved themselves. Then
dry-run the import, read its plan, and write:

```bash
( cd "$IX" && bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php )          # dry run: no database
( cd "$IX" && bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php --yes )    # prints the DB host, then writes
```

**Rollback:** the import only adds rows, and a re-run adds what is missing without overwriting a decision made in
WikiOS. Its group and block rows carry `source = 'mw-import'` (`delete from wiki_user_groups where source = 'mw-import'`,
the same for `wiki_blocks`); the restriction rows it adds are not marked, so undo those from the dump taken in step 1.

## 1c. The api.php session secret (plan 410), before bots use `/w/api.php`

WikiOS serves a MediaWiki-compatible `api.php` at `/w/api.php` for bots (Pywikibot, AWB, the Discord bot). Bot-password
sessions, login tokens and CSRF tokens are HMACs under one key, **`WIKIOS_API_SESSION_SECRET`**:

- **Needed for bots to log in, not for the app to start.** `src/env.ts` treats it as optional, so deploying IxStates
  or WikiOS before it is set takes nothing down. Without it, api.php answers `action=login`, a login token
  (`meta=tokens&type=login`) and any request that carries a session cookie with the MediaWiki error
  `sessionsecretmissing`; it never signs or accepts a session with a fallback key, in development either. Anonymous
  reads (`meta=siteinfo`, `list=allpages`, `action=parse&page=`, ...) keep working, and one warning is logged the first
  time the missing key is needed. Set it before the cutover so bots can log in (step 9's login-token row fails until then).
- **At least 32 characters to be used.** The environment check accepts any value, so a typo never stops a process
  from starting; api.php treats an empty or shorter value as missing (the same `sessionsecretmissing` answers and
  one warning in the log).
- It is a key, not a password: generate it, never type it, and never print it.

```bash
bk "$IX/.env.production.local" env.production.local.1c
grep -c '^WIKIOS_API_SESSION_SECRET=' "$IX/.env.production.local"          # 0 = not set yet; 1 = already there, skip the next line
( umask 077; printf '\nWIKIOS_API_SESSION_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '\n')" >> "$IX/.env.production.local" )
ls -l "$IX/.env.production.local"                                          # same mode as before (-rw-------)
```

**Changing it later** ends every bot session and invalidates every outstanding token (bots log in again; nothing is
stored that cannot be recreated): rotate it if it may have leaked, then restart IxStates (its usual restart) and
WikiOS (`pm2 restart wikios --update-env`). Bot passwords themselves are not affected: users create them on
`Special:BotPasswords` in WikiOS, and each is stored as a salted scrypt hash.

**Rate limits.** api.php counts requests per client in the buckets `wiki_api`, `wiki_api_write`, `wiki_api_login` and
`wiki_api_render` (limits and keys in [rate-limiting.md](rate-limiting.md#wikios-buckets)); there is nothing to
configure, but a bot that is throttled sees MediaWiki's `ratelimited` error, and a client that logs in over and over sees
`Throttled`. The same file lists `wiki_media`, `wiki_export` and `wiki_raw`, the other WikiOS buckets.

**Rollback:** `sudo cp -a "$BK/env.production.local.1c" "$IX/.env.production.local"` and restart the two processes: bots
get `sessionsecretmissing` again and nothing else changes.

## 2. Deploy IxStates as usual

```bash
( cd "$IX" && bun run deploy:prod )     # scripts/deploy-production.sh (master only; takes its own db backup)
```

This also runs `deploy-ixworld.sh`. It does **not** deploy WikiOS: the `wikios` process built in step 5 keeps
serving the code it was built from until `scripts/deploy-wikios.sh` runs again, so run that script after every
IxStates release that touches WikiOS code. `deploy-production.sh` has no lock: never run it while
`deploy-wikios.sh` runs (the WikiOS script refuses to start while `deploy-production.sh` is running).

**Rollback:** the usual IxStates rollback (`bun run deploy:rollback`).

## 3. MediaWiki side: the `wikios-mirror` group, the mirror account, its bot password

The group must exist **before** the account is put into it: `createAndPromote --custom-groups` silently ignores a
group that `$wgGroupPermissions` does not define yet (it prints "is not a valid group, ignoring!"). So load the
snippet first.

### 3a. Load the snippet (article path stays `/wiki/`)

```bash
bk /ixwiki/config/LocalSettings.php LocalSettings.php.step3
sudo cp "$IX/scripts/ops/mediawiki/wikios-localsettings.php" /ixwiki/config/wikios-localsettings.php
sudo chmod 644 /ixwiki/config/wikios-localsettings.php
ls -l /ixwiki/config/wikios-localsettings.php        # must be -rw-r--r--: PHP-FPM (www-data) has to read it
php -l /ixwiki/config/wikios-localsettings.php
```

Append to `/ixwiki/config/LocalSettings.php` (keep the `define`: it keeps `$wgArticlePath = '/wiki/$1'` until step 8):

```php
define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );   // removed in step 8
require_once '/ixwiki/config/wikios-localsettings.php';
```

```bash
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page                  # still 200, still MediaWiki
# the group now exists and has the intended rights (no editinterface / editsitecss / editsitejs):
curl -s 'https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=usergroups&format=json' \
  | jq -r '.query.usergroups[] | select(.name=="wikios-mirror") | .rights | join(" ")'
```

The group's rights must include `import importupload move move-subpages suppressredirect delete undelete protect`
(plan 407: the mirror repeats WikiOS's moves, deletions, undeletions and protections as this account; without
`delete`, `undelete` and `protect` those jobs end up dead with `permissiondenied`).

**PHP and nginx must accept an uploaded XML file of at least 16 MB.** WikiOS mirrors a revision with `action=import`,
which uploads the page as an XML file, and XML escaping makes it bigger than the text: a 2,000,000-character page of
`&` (MediaWiki's page limit is 2 MB) is about 10 MB of XML, and a batch of revisions is capped at about 6 MB. PHP's
default `upload_max_filesize` is 2M. Set both `upload_max_filesize` and `post_max_size` to at least 16M, and check the
`client_max_body_size` of the loopback server of step 4 (WikiOS writes through it, and `wikios-render-internal.conf`
sets 16m) and of the `ixwiki.com` server block (outside bots; nginx's default is 1m). An upload that is too big does not fail quietly: the job's error shows the HTTP status and the start of the
answer, and the job ends up dead for an operator.

```bash
sudo php-fpm8.4 -i 2>/dev/null | grep -E '^(upload_max_filesize|post_max_size)'          # both must show 16M or more
printf 'upload_max_filesize = 16M\npost_max_size = 16M\n' | sudo tee /etc/php/8.4/fpm/conf.d/99-wikios-import.ini
sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
sudo nginx -T 2>/dev/null | grep -n client_max_body_size                                # the ixwiki.com block: 16m or more (step 4 checks the loopback one)
```

**Rollback:** `sudo cp -a "$BK/LocalSettings.php.step3" /ixwiki/config/LocalSettings.php && sudo rm /ixwiki/config/wikios-localsettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm`
(and `sudo rm -f /etc/php/8.4/fpm/conf.d/99-wikios-import.ini`, harmless to keep).

### 3b. Create the account and put it in the group

The account's password is never needed (WikiOS logs in with the bot password), but `createAndPromote` requires one
and takes it as an argument, which `ps` would show. So use a throwaway random value and replace it at once with a
second random value that goes through stdin and is never stored:

```bash
( umask 077
  mwmaint createAndPromote --force --custom-groups wikios-mirror WikiOSMirror "$(openssl rand -hex 24)"
  openssl rand -hex 24 | mwmaint changePassword --user WikiOSMirror --passwordstdin )
# verify the membership (public read-only API; expect "wikios-mirror" among the groups):
curl -s 'https://ixwiki.com/api.php?action=query&list=users&ususers=WikiOSMirror&usprop=groups&format=json' \
  | jq -r '.query.users[0].groups | join(" ")'
curl -s 'https://ixwiki.com/api.php?action=query&list=allusers&augroup=wikios-mirror&format=json' | jq -r '.query.allusers[].name'
```

If `wikios-mirror` is missing from the output, do **not** go on: step 3a did not load (check
`/ixwiki/config/LocalSettings.php`, then repeat the `createAndPromote` line).

**Rollback:** block the account on `Special:Block`, or take every member out of the group with
`mwmaint emptyUserGroup wikios-mirror` and re-run the membership check; nothing public depends on the account yet.

### 3c. Bot password, straight into the WikiOS environment

`createBotPassword` without a password argument generates one and prints it, so nothing secret is passed on a
command line and this password differs from the account's. Capture the output in a 0600 file, move the password
into `.env.production.local`, and destroy the file:

```bash
bk "$IX/.env.production.local" env.production.local
OUT=$(mktemp)
( umask 077
  mwmaint createBotPassword --appid wikios \
    --grants basic,highvolume,editpage,editprotected,createeditmovepage,uploadfile,uploadeditmovefile,import,delete,protect \
    WikiOSMirror > "$OUT" )
grep -c '^Success' "$OUT"                              # must print 1
TOKEN=$(sed -n "s/^Log in using username:'[^']*' and password:'\(.*\)'\.$/\1/p" "$OUT")
( umask 077; printf '\nWIKIOS_MEDIAWIKI_BOT_USER=WikiOSMirror@wikios\nWIKIOS_MEDIAWIKI_BOT_TOKEN=%s\n' "$TOKEN" >> "$IX/.env.production.local" )
unset TOKEN; shred -u "$OUT"
ls -l "$IX/.env.production.local"                      # still -rw------- (or the mode it had)
```

The grants are the ones a bot password can express for the group (`editsemiprotected` comes with `basic`; the move
rights, `suppressredirect` included, come with `createeditmovepage`; `delete` carries delete and undelete, `protect`
protection, for the page-operation mirror jobs of plan 407).
`editprotected`, `import` and `importupload` are intentional: see the comments in
`scripts/ops/mediawiki/wikios-localsettings.php`. **No** `editinterface` or `editsiteconfig`: WikiOS keeps
`Template:`, `Module:` and `MediaWiki:` admin-only.

`WIKI_SYNC_WEBHOOK_SECRET` (at least 32 characters) already exists in that file; step 6 gives MediaWiki the same value.

**Rollback:** restore `sudo cp -a "$BK/env.production.local" "$IX/.env.production.local"`, and delete the bot password
on `Special:BotPasswords` while logged in as `WikiOSMirror` (or block the account). Nothing public depends on it yet.

## 4. Private render engine on loopback

```bash
ss -ltn | grep -E ':8081 |:3560 ' ; echo "exit=$?"                   # must print nothing and exit=1: both ports are free
grep -nE '^\s*root\s' "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"   # the MediaWiki doc root of the public vhost
sudo cp "$IX/scripts/ops/nginx/wikios-render-internal.conf" /etc/nginx/conf.d/wikios-render-internal.conf
sudoedit /etc/nginx/conf.d/wikios-render-internal.conf               # set `root` to the value printed above
sudo nginx -t && sudo systemctl reload nginx
ss -ltnp | grep ':8081'                                              # must show 127.0.0.1:8081 only
curl -s 'http://127.0.0.1:8081/api.php?action=parse&text=%7B%7B%23expr%3A2%2B3%7D%7D&contentmodel=wikitext&format=json' | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/index.php    # 404: only api.php and load.php are served
```

This server carries more than renders: every server-side call to IxWiki's MediaWiki goes through it (plan 415), among them
the mirror's bot login and its `action=edit`, `action=import` (the page as an XML upload of up to about 10 MB) and
`action=upload` POSTs (plans 407 and 411). That is why its `client_max_body_size` is `16m`, matching the PHP limits of
step 3: at 8m a big import would die with a bare 413. Check the installed value, and prove a bot login works through the
loopback, with the password read from the env file into a shell variable, never typed or echoed (it reaches `curl` on
stdin, not on its command line):

```bash
sudo nginx -T 2>/dev/null | awk '/listen 127.0.0.1:8081/,/^}/' | grep client_max_body_size   # 16m
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json'   # must be 200, not 301 (see the warning)
BOT_USER=$(grep '^WIKIOS_MEDIAWIKI_BOT_USER=' "$IX/.env.production.local" | cut -d= -f2-)
BOT_PASS=$(grep '^WIKIOS_MEDIAWIKI_BOT_TOKEN=' "$IX/.env.production.local" | cut -d= -f2-)
JAR=$(mktemp); chmod 600 "$JAR"
LT=$(curl -s -c "$JAR" 'http://127.0.0.1:8081/api.php?action=query&meta=tokens&type=login&format=json' | jq -r '.query.tokens.logintoken')
printf '%s' "$BOT_PASS" | curl -s -b "$JAR" -c "$JAR" -d action=login -d format=json \
  --data-urlencode "lgname=$BOT_USER" --data-urlencode "lgtoken=$LT" --data-urlencode 'lgpassword@-' \
  http://127.0.0.1:8081/api.php | jq -r '.login.result'                  # must print Success
unset BOT_PASS BOT_USER LT; shred -u "$JAR"
```

**Warning: `$wgForceHTTPS`.** If `LocalSettings.php` sets `$wgForceHTTPS = true`, MediaWiki answers a plain-http loopback request with
a redirect to https, and every call of the mirror, the inbound sync and the renderer then fails (a 301 is not an
answer to `action=parse`, and a login POST does not survive it). Confirm the siteinfo request above prints `200`, not `301`.
If it prints `301`, stop here: the loopback needs `$wgForceHTTPS` off (or a condition that spares requests from 127.0.0.1)
before the next step.

The parse call must return JSON containing `"parse"`. Then add this line to `$IX/.env.production.local` by hand (back
it up first: `bk "$IX/.env.production.local" env.production.local.step4`):

```
WIKIOS_MEDIAWIKI_INTERNAL_URL=http://127.0.0.1:8081/api.php
```

(IxStates reads it too and starts rendering through loopback after its next restart; the `wikios` ecosystem file sets
it as well. The mirror's writes and the inbound sync's reads use it too, since every server-side call to IxWiki's MediaWiki
does (plan 415), unless `WIKIOS_MEDIAWIKI_API` names another `api.php` for the mirror; before, they went to the public host,
which after the takeover is WikiOS's own `/api.php`.)

**Rollback:** `sudo rm /etc/nginx/conf.d/wikios-render-internal.conf && sudo nginx -t && sudo systemctl reload nginx`, and
restore `"$BK/env.production.local.step4"` over `$IX/.env.production.local`.

## 5. Build and start the WikiOS process

**IxStates is degraded while `deploy-wikios.sh` builds.** Like `deploy-ixworld.sh`, it moves the IxStates `.next`
aside for the length of the build (several minutes) and restores it afterwards: routes IxStates has not served since
its last start fail and its static chunks 404 meanwhile. Run it off-peak. (Building elsewhere needs a separate copy
of the checkout and `node_modules`; that was judged not worth the risk of an untested build layout.)

**Find the IxStates URL that works.** Production nginx proxies `location ^~ /projects/ixstats` to port 3550, but the
repo's `next.config.js` and deploy scripts use the base path `/projects/ixstates`. Only one of the two answers:

```bash
curl -sI -o /dev/null -w '/projects/ixstats/  -> %{http_code}\n' https://ixwiki.com/projects/ixstats/
curl -sI -o /dev/null -w '/projects/ixstates/ -> %{http_code}\n' https://ixwiki.com/projects/ixstates/
```

The working one answers 200 or a redirect (307/308) to a page; the other answers 404 from MediaWiki. Use the working
one as `IXSTATES_URL` below; the WikiOS build has no default and refuses to start a redirect without it.

```bash
IXSTATES_URL=https://ixwiki.com/projects/ixstates       # <- the one that worked above, no trailing slash
```

Edit the server-local `next.config.js` as described in `deploy/wikios/next-config-snippet.md` (WikiOS branch in
`resolveBasePath()`, early `return []` in `rewrites()`, drop the `/api/ixwiki-proxy` rewrite), check it, then install
the PM2 file, the runtime env and the **build** env, and deploy:

```bash
bk "$IX/next.config.js" next.config.js
# ... edit "$IX/next.config.js" ...
( cd "$IX" && NODE_ENV=production NEXT_PUBLIC_WIKIOS_STANDALONE=true node --input-type=module -e \
    'const { default: c } = await import("./next.config.js"); console.log(JSON.stringify(c.basePath), c.assetPrefix)' )
# expect:  "" undefined

sudo mkdir -p "$WK" && sudo chown "$USER": "$WK"
cp "$IX/deploy/wikios/ecosystem.wikios.config.cjs.example" "$WK/ecosystem.wikios.config.cjs"
ln -sfn "$IX/.env.production.local" "$WK/.env.production.local"           # runtime secrets, shared with IxStates
( umask 077; printf 'NEXT_PUBLIC_IXSTATES_URL=%s\n' "$IXSTATES_URL" > "$WK/.env.wikios-build" )   # build-time, WikiOS only
ls -l "$WK"

"$IX/scripts/deploy-wikios.sh"      # builds (several GB of RAM), rsyncs, pm2 startOrReload --update-env, health probe
pm2 status wikios
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3560/wiki/Main_Page
```

> **Warning: never put `NEXT_PUBLIC_WIKIOS_STANDALONE` into `.env.production` or `.env.production.local`.**
> `deploy-production.sh` exports those files into the IxStates build, which would turn IxStates itself into a WikiOS
> that redirects everything else. The flag is set by `deploy-wikios.sh` (build) and the ecosystem file (runtime)
> only, and the script refuses to run if it finds the flag in an env file. `NEXT_PUBLIC_IXSTATES_URL` lives in
> `$WK/.env.wikios-build`, read by that script only.

The script saves and restores the IxStats `.next` and, on a failed health probe, rolls back to the previous release;
on the **first** deploy there is none, so it says so and leaves the new release in place for inspection (`pm2 logs
wikios`). Private and loopback only: `HOSTNAME=127.0.0.1` in the ecosystem file, nothing public points at port 3560 yet.

### Optional: raise the web XML import limit

The admin page `/util/import` (route `POST /api/wiki/import`) takes a MediaWiki XML dump, plain or gzipped, as the
raw request body and streams it into the importer. It accepts **up to 10 MB** (the code's limit is 9.5 MiB of body),
and says so; anything larger is imported from the command line, which has no limit and streams the file:

```bash
bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --dry-run       # read only: what would happen
bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --yes           # writes to the database in DATABASE_URL
```

The limit is 9.5 MiB, not 10, because Next.js clones every request body for its proxy and caps the clone at
`experimental.proxyClientMaxBodySize` (**10 MiB by default**): a body above that arrives silently truncated, which the
route could not tell from a cut-off dump. Staying under the cap keeps "too large" a clear HTTP 413.

Raising it is an **optional operator step** (skip it unless admins really need bigger uploads in the browser):

1. In the server-local `next.config.js` (the file edited above), set the Next.js cap to the new size, e.g. 50 MiB:

   ```js
   experimental: {
     // ...existing experimental options...
     proxyClientMaxBodySize: "50mb",
   },
   ```

2. Set the route's own limit **below** it (by at least 0.5 MiB: the default is 9.5 against 10), in
   the runtime env of the WikiOS process (`$WK/.env.production.local` is shared with IxStates, so put it in the
   `env` block of `$WK/ecosystem.wikios.config.cjs`):

   ```js
   WIKIOS_IMPORT_MAX_BYTES: String(49.5 * 1024 * 1024),   // 51904512; unset = 9.5 MiB
   ```

3. `pm2 startOrReload "$WK/ecosystem.wikios.config.cjs" --update-env`, then rebuild (`next.config.js` changed) with
   `"$IX/scripts/deploy-wikios.sh"`. The import page reads the limit from the server, so it states the new number.

Both numbers must move together: a route limit at or above the Next.js cap reintroduces silent truncation. A gzipped
dump is bounded twice, by the bytes sent (this limit) and by what it expands to (256 MiB, fixed in the route).

**Rollback:** `pm2 delete wikios && pm2 save`; `sudo cp -a "$BK/next.config.js" "$IX/next.config.js"` if you want the
file as it was (edits 1 and 2 do not affect the IxStates build). Edit 3 (dropping `/api/ixwiki-proxy`) is the change
the plan asks for; nothing in `src/` uses that path.

## 6. Give MediaWiki the webhook secret

PHP-FPM clears its environment, so the secret goes into the pool file
(`/etc/php/8.4/fpm/pool.d/www.conf`) with the **same value** as `WIKI_SYNC_WEBHOOK_SECRET`. That file then holds a
secret, so it is made root-only. Edit it by hand, do not echo the value:

```bash
bk /etc/php/8.4/fpm/pool.d/www.conf www.conf
sudoedit /etc/php/8.4/fpm/pool.d/www.conf
#   add:   env[WIKIOS_WEBHOOK_SECRET] = <same value as WIKI_SYNC_WEBHOOK_SECRET>
sudo chown root:root /etc/php/8.4/fpm/pool.d/www.conf && sudo chmod 0640 /etc/php/8.4/fpm/pool.d/www.conf
ls -l /etc/php/8.4/fpm/pool.d/www.conf                  # -rw-r----- root root
sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page    # still 200, still MediaWiki
```

From now on, saving a page through the web in MediaWiki POSTs `{"title": ...}` to
`http://127.0.0.1:3560/api/wiki/sync-webhook`; edits made by the `wikios-mirror` group are skipped (echo guard). Edits
made from the command line, by jobs or by imports do not announce themselves (no secret in their environment); WikiOS'
`wiki-recentchanges` cron job (every 10 minutes) imports them. Check after a test edit:
`pm2 logs wikios --lines 30 --nostream | grep sync-webhook`.

**Rollback:** `sudo cp -a "$BK/www.conf" /etc/php/8.4/fpm/pool.d/www.conf && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm`.

## 7. Pre-cutover checks (nothing public yet)

Pick real examples for the gate rows (they must exist: a page and one of its revisions, a template subpage, a category,
a file and an upload), using the private render engine:

```bash
IXSTATES_URL=$(sed -n 's/^NEXT_PUBLIC_IXSTATES_URL=//p' "$WK/.env.wikios-build")
R='http://127.0.0.1:8081/api.php?format=json&action=query'
curl -s "$R&prop=revisions&titles=Main_Page&rvprop=ids&rvlimit=1&rvdir=newer" | jq -r '.query.pages[].revisions[0].revid'   # -> REVID
curl -s "$R&titles=Template:Infobox_country/doc%7CCategory:Countries" | jq -c '.query.pages[] | {title, missing: has("missing")}'
find /ixwiki/shared/images -maxdepth 3 -type f -name '*.png' | head -3
```

```bash
( cd "$IX" && bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --ixstates "$IXSTATES_URL" \
    --internal http://127.0.0.1:8081 --standalone --page Main_Page --revid <REVID> \
    --subpage Template:Infobox_country/doc --category Category:Countries )
```

Every row must PASS: `/` (302 to `/wiki/Main_Page`), `/wiki/Main_Page`, `/robots.txt`, `/wiki-sitemap`, a template subpage, a
category page, `Special:Search`, `?action=raw` (as `text/x-wiki`), `?oldid=`, the runtime requests WikiOS pages make that
are not routes (`/api/ixtime/current`, `/maplibre/maplibre-gl-worker.mjs`, `/flags/...`, `/images/flags/placeholder.svg`,
`/fonts/...`), `/maps?embed=true` (302 to the IxStates map that article map embeds load), the configured IxStates URL
(not 404) and the loopback `action=parse`. The routes of plans 410 and 412 (robots, sitemap, subpages, raw, oldid,
Special:Search) fail until those plans are deployed into the WikiOS build. Then open
`http://127.0.0.1:3560/wiki/Main_Page` through an SSH tunnel (`ssh -L 3560:127.0.0.1:3560 ixwiki`) with the browser
devtools network tab open: **no asset may 404 or redirect to IxStates** (the allowed prefixes are
`WIKIOS_ALLOWED_PREFIXES` in `src/lib/system/wikios-standalone.ts`; `wikios-takeover.conf` routes the same set). A
missing prefix must be added to both before step 8.

**Shadowing checks.** nginx will send `/robots.txt`, `/sitemap*`, `/wiki-sitemap*`, `/images/flags/`, `= /maps`, `/sign-in`,
`/sign-up` and `/sso-callback` to WikiOS, in front of anything MediaWiki served there. Check that nothing real is
hidden by that (each command should report "No such file" or print nothing):

```bash
DOCROOT=<the root value printed in step 4>
ls -l "$DOCROOT"/robots.txt "$DOCROOT"/sitemap* "$DOCROOT"/wiki-sitemap* 2>&1     # static files would be shadowed
ls -ld /ixwiki/shared/images/flags 2>&1                                          # an upload directory named "flags" would be shadowed
mysql ixwiki -e "SELECT page_title FROM page WHERE page_namespace = 0 AND (page_title IN ('Maps','Sign-in','Sign-up','Sso-callback') OR page_title LIKE 'Sitemap%')"
```

(read-only, local database `ixwiki`, no table prefix; MediaWiki capitalises the first letter, so these are the
lower-case paths' articles). Root-level short URLs such as `ixwiki.com/Foo` keep serving classic MediaWiki.

Other links WikiOS pages render to IxStates-only routes (`/blurbs`, `/mycountry`, `/dashboard`, `/countries`,
`/achievements`, `/settings`, `/messages`) are root-relative in the standalone build and are **not** forwarded: on
ixwiki.com they reach MediaWiki until they are prefixed with the IxStates URL in the app or forwarded in nginx.

**Rollback:** not needed (nothing changed).

## 8. Cut over

Do step 10a (PHP-FPM watchdog) **before** this step. Then install the nginx takeover and, right after the nginx reload,
flip the MediaWiki article path: nginx first, because `/classic/` and the WikiOS `/wiki/` must exist before MediaWiki
starts generating `/classic/` links (until the flip it still emits `/wiki/` links, which now reach WikiOS: no broken
window). Run 8a and 8b back to back.

### 8a. nginx

```bash
bk "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)" ixwiki.com.nginx
sudo cp "$IX/scripts/ops/nginx/wikios-upstream.conf"     /etc/nginx/conf.d/wikios-upstream.conf
sudo cp "$IX/scripts/ops/nginx/wikios-proxy-params.conf" /etc/nginx/snippets/wikios-proxy-params.conf
sudo cp "$IX/scripts/ops/nginx/wikios-takeover.conf"     /etc/nginx/snippets/wikios-takeover.conf
#   step 10b: route the chatty locations to their own log (the sed on the copied snippet), before nginx -t
sudoedit "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
#   - add  `include snippets/wikios-takeover.conf;`  at the top of the ixwiki.com server block
#     (it also holds `location ^~ /w/`, which sends WikiOS's api.php, /w/api.php, to WikiOS with a 5m body limit;
#      classic MediaWiki does not use /w/ on this server, so nothing is replaced for it)
#   - delete what the header of wikios-takeover.conf lists as replaced:
#       * location ^~ /wiki/ { try_files $uri @mediawiki; }
#       * the ^/wiki/(.*)$ rewrite line inside location @mediawiki  (keep the /search/ and /([^/]+) rewrites)
#       * any existing `location = /`
sudo nginx -t && sudo systemctl reload nginx     # duplicate-location errors mean one of the deletions above was missed
```

### 8b. MediaWiki article path, then caches

```bash
bk /ixwiki/config/LocalSettings.php LocalSettings.php.step8
sudoedit /ixwiki/config/LocalSettings.php
#   delete the line  define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );  so the snippet sets $wgArticlePath = '/classic/$1'
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
```

Cached HTML still carries `/wiki/` links. Editing `LocalSettings.php` invalidates it when
`$wgInvalidateCacheOnLocalSettingsChange` is true (the default): check that the server has not turned it off, and free
the parser cache rows either way (this only works when the parser cache is in the database):

```bash
grep -n 'InvalidateCacheOnLocalSettingsChange\|CacheEpoch' /ixwiki/config/LocalSettings.php    # nothing, or "true"
mwmaint purgeParserCache --age 0
```

If the first command shows the setting as `false`, set `$wgCacheEpoch` to now (`date +%Y%m%d%H%M%S`) in
`LocalSettings.php` and reload PHP-FPM instead. Then purge Cloudflare's cache for `/wiki/*` so stale MediaWiki HTML is
not served at the new URLs: dashboard Caching, Configuration, Custom Purge (prefix `ixwiki.com/wiki/`, available on
Enterprise) or Purge Everything. The API equivalent needs a token with the **Cache Purge** permission (the bot-defense
token in `/etc/ixwiki-defense.conf` only has firewall/WAF rights; do not reuse it):

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" -H "Content-Type: application/json" --data '{"purge_everything":true}'
```

**Rollback:** step 12 (it restores `$BK/ixwiki.com.nginx` and `$BK/LocalSettings.php.step8`).

## 9. Verify the public site

```bash
( cd "$IX" && bun scripts/ops/verify-wikios-takeover.ts --base https://ixwiki.com --ixstates "$IXSTATES_URL" \
    --internal http://127.0.0.1:8081 --page Main_Page --revid <REVID> \
    --subpage Template:Infobox_country/doc --category Category:Countries \
    --file <ExistingFile.png> --image /images/<a>/<ab>/<ExistingFile.png> )
```

Every row must PASS (exit code 0). The public `/api.php` row still expects MediaWiki's `sitename`: `/api.php` stays
MediaWiki's, and WikiOS's own api.php has two rows of its own at `/w/api.php` (siteinfo, and a login token, which
answers `sessionsecretmissing` and so fails while `WIKIOS_API_SESSION_SECRET` is missing). A bot's smoke test: `curl -s
'https://ixwiki.com/w/api.php?action=query&meta=siteinfo&format=json'` answers JSON with the site name, and a
Pywikibot login with a bot password made on `Special:BotPasswords` succeeds. Also click through by hand: an article, an old revision
(`/index.php?title=Foo&oldid=N` redirects to `/wiki/Foo?oldid=N`), `action=edit` on classic, a classic
`Special:` page, an image, login, and one `?action=purge` (`/wiki/Foo?action=purge` is answered by classic MediaWiki).

**Rollback:** step 12.

## 10. Monitor (first 24 hours)

| Watch | How |
|-------|-----|
| WikiOS process | `pm2 logs wikios`, `pm2 status wikios` (restarts column), `pm2 jlist` RSS |
| nginx | `tail -f /var/log/nginx/error.log`; 5xx on `/wiki/`: `awk '$9>=500 && $7 ~ "^/wiki/"' /var/log/nginx/access.log \| tail` |
| Bot defense, fail2ban | step 10b; afterwards `/usr/local/bin/ixwiki-bot-defense.sh status`, `tail -f /var/log/ixwiki-bot-defense.log`, `fail2ban-client status ixwiki-bots` |
| PHP-FPM watchdog | step 10a; afterwards `tail -f /ixwiki/private/logs/php-fpm-watchdog.log` |
| Webhook | `pm2 logs wikios \| grep sync-webhook`; 401 means the two secrets differ, 503 means WikiOS has none, 429 means more than 600 a minute |
| Discord DMs | disk alert, PHP-FPM watchdog and bot-defense alerts reach the admin through `ixwiki-notify.sh` |
| Disk | `df -h /` (WikiOS logs go to `/var/log/pm2/`, rotated at 50M x 5; nginx logs rotate through `/etc/logrotate.d/nginx`) |

### 10a. PHP-FPM watchdog: make it probe MediaWiki, not WikiOS (before step 8)

The watchdog (`/ixwiki/private/scripts/php-fpm-watchdog.sh`, service `php-fpm-watchdog`) restarts PHP-FPM when the
wiki answers HTTP 500. After the cutover `/wiki/*` is WikiOS, so a probe of `/wiki/Main_Page` would restart PHP-FPM
(and DM the admin) for WikiOS errors PHP-FPM cannot fix, and would stop noticing real MediaWiki failures. Its other
trigger, more than 50 `upstream prematurely closed` lines in 60 seconds of `/var/log/nginx/error.log`, stays valid.

```bash
grep -nE 'curl|https?://|Main_Page|/wiki/' /ixwiki/private/scripts/php-fpm-watchdog.sh     # find the probe URL
bk /ixwiki/private/scripts/php-fpm-watchdog.sh php-fpm-watchdog.sh
sudoedit /ixwiki/private/scripts/php-fpm-watchdog.sh
```

Replace the probe URL the `grep` showed with the private render engine (up since step 4, always MediaWiki, not
subject to Cloudflare or the public rate limits):

```
http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json
```

If the script also greps the response body for a string from the old page, use `sitename`. Acceptable alternative
once step 8 is done: `https://ixwiki.com/classic/Main_Page`. Do **not** use the public `https://ixwiki.com/api.php`:
it moves to WikiOS when WikiOS serves its own `api.php` subset.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api.php?action=query&meta=siteinfo&format=json'   # 200
sudo bash -n /ixwiki/private/scripts/php-fpm-watchdog.sh
sudo systemctl restart php-fpm-watchdog
systemctl status php-fpm-watchdog --no-pager | head -5
tail -n 20 /ixwiki/private/logs/php-fpm-watchdog.log        # no restart entry after the edit
```

**Rollback:** `sudo cp -a "$BK/php-fpm-watchdog.sh" /ixwiki/private/scripts/php-fpm-watchdog.sh && sudo systemctl restart php-fpm-watchdog`.

### 10b. Bot defense and fail2ban: do not count WikiOS' chatty requests (before step 8)

The bot-defense daemon (`/usr/local/bin/ixwiki-bot-defense.sh`, 60 requests per minute per IP, set in
`/etc/ixwiki-defense.conf`) and the fail2ban jail `ixwiki-bots` (more than 60 requests per minute, one-hour ban) both
read `/var/log/nginx/access.log`. One cold WikiOS page load is a document plus dozens of `/_next/static/` chunks, fonts
and flag files, and every page then sends tRPC batches (`/api/trpc/`) and an IxTime refresh (`/api/ixtime/current`). Two
article views in a minute can cross 60, and a real reader would be blocked at the Cloudflare edge. Two changes, both
default:

**1. Keep the chatty locations out of the counted log.** They are still logged, in their own file, which the daemon and
fail2ban do not read and Debian's nginx logrotate already rotates (`/var/log/nginx/*.log`). Run this on the copy of the
snippet in step 8a, before `nginx -t`:

```bash
grep -n 'var/log/nginx' /etc/logrotate.d/nginx              # expect the /var/log/nginx/*.log glob: the new file rotates too
sudo sed -i -E '/^location (\^~|=) \/(_next|fonts|flags|maplibre|images\/flags|images\/wikios|wikios-|favicon-wikios|api\/trpc|api\/ixtime\/current)[^ ]* \{$/a\    access_log /var/log/nginx/wikios-quiet.log;' /etc/nginx/snippets/wikios-takeover.conf
grep -c 'wikios-quiet.log' /etc/nginx/snippets/wikios-takeover.conf     # must print 10 (run the sed once only)
```

**2. Raise the per-IP limits.** Dynamic `/wiki/` views still count, and a reader who opens several articles quickly
must not be banned:

```bash
bk /etc/ixwiki-defense.conf ixwiki-defense.conf
bk /etc/fail2ban/jail.d/ixwiki-bots.conf ixwiki-bots.jail.conf
grep -niE 'ip|per' /etc/ixwiki-defense.conf                 # the per-IP requests-per-minute value (default 60)
sudoedit /etc/ixwiki-defense.conf                           # set it to 240
sudoedit /etc/fail2ban/jail.d/ixwiki-bots.conf              # multiply the ixwiki-bots maxretry by 4 (same findtime)
sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload
```

Check after the cutover, from a browser with a cold cache: open `https://ixwiki.com/wiki/Main_Page` and three more
articles within a minute, then

```bash
/usr/local/bin/ixwiki-bot-defense.sh status               # your IP must not be listed as blocked
fail2ban-client status ixwiki-bots                        # your IP must not be banned
```

If a reader is blocked: `sudo fail2ban-client set ixwiki-bots unbanip <ip>`, and remove the IP under Cloudflare,
Security, WAF, Tools (IP Access Rules). Trade-off of change 1: a flood of requests to the quiet locations is no longer
seen by the daemon and fail2ban (Cloudflare still sees it, and `wikios-quiet.log` has it).

**Rollback:** `sudo cp -a "$BK/ixwiki-defense.conf" /etc/ixwiki-defense.conf && sudo cp -a "$BK/ixwiki-bots.jail.conf" /etc/fail2ban/jail.d/ixwiki-bots.conf && sudo systemctl restart ixwiki-bot-defense && sudo fail2ban-client reload`;
for change 1, re-copy the snippet from the checkout (step 8a) and `sudo nginx -t && sudo systemctl reload nginx`.

## 11. Footprint measurement

Compare with `baseline.txt` from step 0 (run once traffic has settled, then again a day later):

```bash
{
  date -Is
  echo "--- php-fpm pool RSS (MB):"
  ps -C php-fpm8.4 -o rss= | awk '{s+=$1} END {printf "%.0f\n", s/1024}'
  echo "--- wikios:"
  pm2 jlist | jq -r '.[] | select(.name=="wikios") | "rss=\((.monit.memory/1048576)|floor)MB cpu=\(.monit.cpu)%"'
  echo "--- free -m:";  free -m
  echo "--- uptime:";   uptime
  curl -s -o /dev/null -w "Main_Page total: %{time_total}s\n" "https://ixwiki.com/wiki/Main_Page"
} | tee /ixwiki/private/logs/wikios-cutover/after.txt
diff /ixwiki/private/logs/wikios-cutover/baseline.txt /ixwiki/private/logs/wikios-cutover/after.txt
```

Expectations: the `wikios` RSS stays below the 1400 MB PM2 restart limit of the example ecosystem file (Node heap
limit 1536 MB), the PHP-FPM pool RSS drops because `/wiki/*` views no longer run PHP, and the page time does not get worse.

## 12. Rollback (full)

Reverses step 8 only; WikiOS keeps running harmlessly on loopback. Undo in the opposite order of step 8, MediaWiki
first (so MediaWiki stops emitting `/classic/` links before `/classic/` disappears):

```bash
sudo cp -a "$BK/LocalSettings.php.step8" /ixwiki/config/LocalSettings.php        # article path back to /wiki/
php -l /ixwiki/config/LocalSettings.php && sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
sudo cp -a "$BK/ixwiki.com.nginx" "$(readlink -f /etc/nginx/sites-enabled/ixwiki.com)"
sudo nginx -t && sudo systemctl reload nginx
mwmaint purgeParserCache --age 0                                                 # /classic/ links out of cached HTML
# then purge the Cloudflare cache for /wiki/* again (step 8b)
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page      # MediaWiki again
```

(The files in `/etc/nginx/conf.d/` and `/etc/nginx/snippets/` are inert without the `include`; the `wikios-upstream.conf`
`map`s and `upstream` are harmless.) Undo steps 10a and 10b from their own rollback lines if the watchers misbehave.
To also stop WikiOS: `pm2 delete wikios && pm2 save`.

## Server-local files this cutover edits (none of them are in git)

Every one of them is copied into `$BK` before its first edit.

| File | Edit | Step |
|------|------|------|
| `/ixwiki/public/projects/ixstats/next.config.js` | `resolveBasePath()` WikiOS branch; `rewrites()` early return; **remove the `/api/ixwiki-proxy` rewrite** | 5 |
| `/ixwiki/public/projects/ixstats/.env.production.local` | `WIKIOS_API_SESSION_SECRET` (1c); `WIKIOS_MEDIAWIKI_BOT_USER`, `WIKIOS_MEDIAWIKI_BOT_TOKEN`, `WIKIOS_MEDIAWIKI_INTERNAL_URL` (never `NEXT_PUBLIC_WIKIOS_STANDALONE`) | 1c, 3c, 4 |
| `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` | new, from the `.example` | 5 |
| `/ixwiki/public/wikios/.env.wikios-build` | new: `NEXT_PUBLIC_IXSTATES_URL` (build-time, WikiOS only) | 5 |
| `/etc/nginx/conf.d/wikios-render-internal.conf`, `wikios-upstream.conf` | new | 4, 8 |
| `/etc/nginx/snippets/wikios-proxy-params.conf`, `wikios-takeover.conf` | new | 8 |
| target of `/etc/nginx/sites-enabled/ixwiki.com` | `include` added; `/wiki/` location, `@mediawiki` `/wiki/` rewrite and any `location = /` removed | 8 |
| `/ixwiki/config/LocalSettings.php` | `require_once` of the snippet plus `define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true )` in 3a; the `define` removed in 8b | 3a, 8b |
| `/ixwiki/config/wikios-localsettings.php` | new, copy of the tracked snippet (mode 644) | 3a |
| `/etc/php/8.4/fpm/pool.d/www.conf` | `env[WIKIOS_WEBHOOK_SECRET]`; mode 0640 root:root | 6 |
| `/ixwiki/private/scripts/php-fpm-watchdog.sh` | probe URL `http://127.0.0.1:8081/api.php?...` | 10a |
| `/etc/ixwiki-defense.conf`, `/etc/fail2ban/jail.d/ixwiki-bots.conf` | per-IP limit 240; `maxretry` x 4 | 10b |

## Later

IxStates moves to ixstates.com (owner decision D11): then `NEXT_PUBLIC_IXSTATES_URL` in `$WK/.env.wikios-build`
changes, the WikiOS build is redeployed, and classic MediaWiki moves to `classic.ixwiki.com`. WikiOS's api.php already
answers at `/w/api.php` (step 8a); when bots have moved to it, `/api.php` can join the WikiOS locations in
`wikios-takeover.conf` and the matching row of `verify-wikios-takeover.ts` changes.
