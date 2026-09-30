# WikiOS v1 cutover runbook

**Status:** nothing in this runbook has been applied. It is written for a human operator on the production server
(`ssh ixwiki`). Plan 417, September 30, 2026. It replaces the superseded
[Stage 3 config plan](../systems/wikios/wikios-stage3-config-plan.md).

**What changes.** WikiOS runs as its own Next.js process (`pm2` app `wikios`, `127.0.0.1:3560`, like IxWorld at
maps.ixwiki.com) and takes over `ixwiki.com/wiki/*`. Classic MediaWiki stays editable at
`ixwiki.com/classic/*` and `index.php?...action=edit`. MediaWiki also becomes a private render engine on
`127.0.0.1:8081` (`action=parse&text=`), and every saved MediaWiki page is announced to WikiOS by a webhook.
IxStates (`/projects/ixstats`, port 3550) and IxWorld (port 3002) are untouched.

**Order matters.** Steps 1 to 7 change nothing the public can see. Step 8 is the cutover (an nginx reload plus one
`LocalSettings.php` line). Every step has a rollback line; step 12 is the full rollback.

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

Do this from the IxStats checkout unless a step says otherwise:

```bash
cd /ixwiki/public/projects/ixstats
git log -1 --oneline            # the release that contains plan 417 and the WikiOS plans it depends on
df -h /                         # need several GB free: a full root disk takes Postgres down
```

## 0. Baseline (before touching anything)

Record these for step 11:

```bash
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

## 1. Apply the WikiOS SQL migrations

The WikiOS plans add hand-written, idempotent SQL under `prisma/manual-migrations/`. Take a dump first, then apply
the files in filename order:

```bash
bun run db:backup                                   # aborts non-zero on failure; dump lands in backups/
ls prisma/manual-migrations/*wikios*.sql | sort     # review the list; read each file before applying
for f in $(ls prisma/manual-migrations/*wikios*.sql | sort); do
  echo "== $f"
  docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$f" || break
done
```

**Rollback:** the files are additive and idempotent, so the running app is unaffected if you stop here. To undo,
restore the dump taken above (`pg_restore` into a scratch database first; never `docker system prune`).

## 2. Deploy IxStates as usual

```bash
bun run deploy:prod        # scripts/deploy-production.sh (master only; takes its own db backup)
```

This also runs `deploy-ixworld.sh`. It does **not** deploy WikiOS: the `wikios` process built in step 5 keeps
serving the code it was built from until `scripts/deploy-wikios.sh` runs again, so run that script after every
IxStates release that touches WikiOS code.

**Rollback:** the usual IxStates rollback (`bun run deploy:rollback`).

## 3. Create the WikiOSMirror account and its bot password

The mirror account is how WikiOS writes to MediaWiki. Generate the password into a 0600 file so it never appears in
shell history or logs; do not paste it anywhere:

```bash
cd /ixwiki/mediawiki/releases/1.45.1        # the MediaWiki install (adjust if the doc root differs)
umask 077
openssl rand -hex 24 > /ixwiki/private/wikios-mirror.pass
sudo -u www-data php maintenance/run.php createAndPromote --force --custom-groups wikios-mirror \
  WikiOSMirror "$(cat /ixwiki/private/wikios-mirror.pass)"
sudo -u www-data php maintenance/run.php createBotPassword --appid wikios \
  --grants basic,highvolume,editpage,editprotected,createeditmovepage,uploadfile,uploadeditmovefile,import \
  WikiOSMirror "$(cat /ixwiki/private/wikios-mirror.pass)"
```

The grants are the ones a bot password can express for the `wikios-mirror` group defined in
`scripts/ops/mediawiki/wikios-localsettings.php`. **No** `editinterface` or `editsiteconfig`: WikiOS keeps
`Template:`, `Module:` and `MediaWiki:` admin-only. (The group only gets its rights once step 6 loads the snippet;
adding the account to the group now is harmless.)

Put the credentials in the WikiOS environment, `/ixwiki/public/projects/ixstats/.env.production.local` (the file
step 5 links into the WikiOS directory). Edit the file by hand; do not `echo` the values:

```
WIKIOS_MEDIAWIKI_BOT_USER=WikiOSMirror@wikios
WIKIOS_MEDIAWIKI_BOT_TOKEN=<contents of /ixwiki/private/wikios-mirror.pass>
```

`WIKI_SYNC_WEBHOOK_SECRET` (at least 32 characters) already exists there; step 6 gives MediaWiki the same value.
Then `shred -u /ixwiki/private/wikios-mirror.pass` once the value is stored in the env file.

**Rollback:** remove the two env lines; in MediaWiki delete the bot password on `Special:BotPasswords` while logged in as
`WikiOSMirror`, or block the account on `Special:Block`. Nothing public depends on it yet.

## 4. Private render engine on loopback

```bash
grep -nE '^\s*root\s' /etc/nginx/sites-enabled/ixwiki.com          # the MediaWiki doc root of the public vhost
sudo cp scripts/ops/nginx/wikios-render-internal.conf /etc/nginx/conf.d/wikios-render-internal.conf
sudoedit /etc/nginx/conf.d/wikios-render-internal.conf              # set `root` to the value printed above
sudo nginx -t && sudo systemctl reload nginx
ss -ltnp | grep ':8081'                                             # must show 127.0.0.1:8081 only
curl -s 'http://127.0.0.1:8081/api.php?action=parse&text=%7B%7B%23expr%3A2%2B3%7D%7D&contentmodel=wikitext&format=json' | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/index.php    # 404: only api.php and load.php are served
```

The parse call must return JSON containing `"parse"`. Then set `WIKIOS_MEDIAWIKI_INTERNAL_URL` in
`/ixwiki/public/projects/ixstats/.env.production.local`:

```
WIKIOS_MEDIAWIKI_INTERNAL_URL=http://127.0.0.1:8081/api.php
```

(IxStates reads it too and starts rendering through loopback after its next restart; the `wikios` ecosystem file sets
it as well.)

**Rollback:** `sudo rm /etc/nginx/conf.d/wikios-render-internal.conf && sudo nginx -t && sudo systemctl reload nginx`, and
remove the env line.

## 5. Build and start the WikiOS process

Edit the server-local `next.config.js` as described in `deploy/wikios/next-config-snippet.md` (WikiOS branch in
`resolveBasePath()`, early `return []` in `rewrites()`, drop the `/api/ixwiki-proxy` rewrite), check it, then install
the PM2 file and the runtime env, and deploy:

```bash
NODE_ENV=production NEXT_PUBLIC_WIKIOS_STANDALONE=true node --input-type=module -e \
  'const { default: c } = await import("./next.config.js"); console.log(JSON.stringify(c.basePath), c.assetPrefix)'
# expect:  "" undefined

sudo mkdir -p /ixwiki/public/wikios && sudo chown "$USER": /ixwiki/public/wikios
cp deploy/wikios/ecosystem.wikios.config.cjs.example /ixwiki/public/wikios/ecosystem.wikios.config.cjs
ln -sfn /ixwiki/public/projects/ixstats/.env.production.local /ixwiki/public/wikios/.env.production.local

./scripts/deploy-wikios.sh          # builds (several GB of RAM, run off-peak), rsyncs, pm2 startOrReload, health probe
pm2 status wikios
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3560/wiki/Main_Page
```

The script saves and restores the IxStats `.next` and rolls back on a failed health probe. Private and loopback
only: `HOSTNAME=127.0.0.1` in the ecosystem file, nothing public points at port 3560 yet.

**Rollback:** `pm2 delete wikios && pm2 save`; put the three `next.config.js` edits back if you want the file as it
was (the IxStates build is unaffected by edits 1 and 2). Edit 3 (dropping `/api/ixwiki-proxy`) is the change the
plan asks for; nothing in `src/` uses that path.

## 6. Load the MediaWiki snippet (article path stays `/wiki/`)

```bash
cp scripts/ops/mediawiki/wikios-localsettings.php /ixwiki/config/wikios-localsettings.php
php -l /ixwiki/config/wikios-localsettings.php
```

Append to `/ixwiki/config/LocalSettings.php`, keeping `$wgArticlePath = '/wiki/$1'` for now:

```php
define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );   // removed in step 8
require_once '/ixwiki/config/wikios-localsettings.php';
```

Give MediaWiki the webhook secret. PHP-FPM clears its environment, so add to the pool file
(`/etc/php/8.4/fpm/pool.d/www.conf`) the line below with the **same value** as `WIKI_SYNC_WEBHOOK_SECRET` (edit by
hand, do not echo it):

```
env[WIKIOS_WEBHOOK_SECRET] = <same value as WIKI_SYNC_WEBHOOK_SECRET>
```

```bash
sudo php-fpm8.4 -t && sudo systemctl reload php8.4-fpm
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page    # still 200, still MediaWiki
```

From now on, saving a page in MediaWiki POSTs `{"title": ...}` to `http://127.0.0.1:3560/api/wiki/sync-webhook`;
edits made by the `wikios-mirror` group are skipped (echo guard). Check after a test edit:
`pm2 logs wikios --lines 30 --nostream | grep sync-webhook`.

**Rollback:** delete the two lines from `LocalSettings.php` and the `env[...]` line from the pool file, then
`sudo systemctl reload php8.4-fpm`.

## 7. Pre-cutover checks (nothing public yet)

```bash
bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --internal http://127.0.0.1:8081 --standalone
```

Expect PASS for `/` (302 to `/wiki/Main_Page`), `/wiki/Main_Page`, the runtime requests WikiOS pages make that are
not routes (`/api/ixtime/current`, `/maplibre/maplibre-gl-worker.mjs`, `/flags/...`, `/images/flags/placeholder.svg`,
`/fonts/...`), `/maps?embed=true` (302 to the IxStates map, which is what the article map embeds load),
`/projects/ixstats` (redirected to IxStates, not 404) and the loopback `action=parse`. Then open
`http://127.0.0.1:3560/wiki/Main_Page` through an SSH tunnel (`ssh -L 3560:127.0.0.1:3560 ixwiki`) with the browser
devtools network tab open: **no asset may 404 or redirect to IxStates** (the allowed prefixes are
`WIKIOS_ALLOWED_PREFIXES` in `src/lib/system/wikios-standalone.ts`; `wikios-takeover.conf` routes the same set). A
missing prefix must be added to both before step 8.

nginx forwards `= /maps`, `/sign-in`, `/sign-up`, `/sso-callback` and `/sitemap*` to WikiOS, so they shadow a
MediaWiki article whose title is the same in lower case (MediaWiki capitalises the first letter). Check that none
exists (read-only, local database `ixwiki`, no table prefix):

```bash
mysql ixwiki -e "SELECT page_title FROM page WHERE page_namespace = 0 AND (page_title IN ('Maps','Sign-in','Sign-up','Sso-callback') OR page_title LIKE 'Sitemap%')"
```

Other links WikiOS pages render to IxStates-only routes (`/blurbs`, `/mycountry`, `/dashboard`, `/countries`,
`/achievements`, `/settings`, `/messages`) are root-relative in the standalone build and are **not** forwarded: on
ixwiki.com they reach MediaWiki until they are prefixed with the IxStates URL in the app or forwarded in nginx.

**Rollback:** not needed (nothing changed).

## 8. Cut over

Two watchers break on the first day if they are left as they are: do step 10a (PHP-FPM watchdog) first, and step 10b
(bot defense and fail2ban) on the copied snippet, between the `cp` lines and `nginx -t` below. Then one change in
MediaWiki, then nginx. Keep a backup of the site file:

```bash
# 8a. MediaWiki: stop keeping /wiki/ as the article path. In /ixwiki/config/LocalSettings.php delete
#     the line  define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );  so the snippet sets $wgArticlePath = '/classic/$1'.
#     (Do not reload php-fpm yet if you want both changes to land together; do it right before the nginx reload.)

# 8b. nginx
sudo cp /etc/nginx/sites-enabled/ixwiki.com /ixwiki/private/backups/ixwiki.com.pre-wikios
sudo cp scripts/ops/nginx/wikios-upstream.conf     /etc/nginx/conf.d/wikios-upstream.conf
sudo cp scripts/ops/nginx/wikios-proxy-params.conf /etc/nginx/snippets/wikios-proxy-params.conf
sudo cp scripts/ops/nginx/wikios-takeover.conf     /etc/nginx/snippets/wikios-takeover.conf
#   step 10b: keep static assets out of the access log (the sed on the copied snippet) before nginx -t
sudoedit /etc/nginx/sites-enabled/ixwiki.com
#   - add  `include snippets/wikios-takeover.conf;`  at the top of the ixwiki.com server block
#   - delete what the header of wikios-takeover.conf lists as replaced:
#       * location ^~ /wiki/ { try_files $uri @mediawiki; }
#       * the ^/wiki/(.*)$ rewrite line inside location @mediawiki  (keep the /search/ and /([^/]+) rewrites)
#       * any existing `location = /`
sudo nginx -t                      # duplicate-location errors mean one of the deletions above was missed
sudo systemctl reload php8.4-fpm && sudo systemctl reload nginx
```

Purge Cloudflare's cache for `/wiki/*` so stale MediaWiki HTML is not served at the new URLs: dashboard
Caching, Configuration, Custom Purge (prefix `ixwiki.com/wiki/`, available on Enterprise) or Purge Everything. The API
equivalent needs a token with the **Cache Purge** permission (the bot-defense token in `/etc/ixwiki-defense.conf` only
has firewall/WAF rights; do not reuse it):

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" -H "Content-Type: application/json" --data '{"purge_everything":true}'
```

**Rollback:** step 12.

## 9. Verify the public site

```bash
# pick a real upload and a real file page first:
find /ixwiki/shared/images -maxdepth 3 -type f -name '*.png' | head -3
bun scripts/ops/verify-wikios-takeover.ts --base https://ixwiki.com --internal http://127.0.0.1:8081 \
  --file <ExistingFile.png> --image /images/<a>/<ab>/<ExistingFile.png>
```

Every row must PASS (exit code 0). The public `/api.php` row still expects MediaWiki's `sitename`; it changes when
WikiOS serves its own `api.php` subset. Also click through by hand: an article, an old revision
(`/index.php?title=Foo&oldid=N` redirects to `/wiki/Foo?oldid=N`), `action=edit` on classic, a
`Special:` page on classic, an image, login.

**Rollback:** step 12.

## 10. Monitor (first 24 hours)

| Watch | How |
|-------|-----|
| WikiOS process | `pm2 logs wikios`, `pm2 status wikios` (restarts column), `pm2 jlist` RSS |
| nginx | `tail -f /var/log/nginx/error.log`; 5xx on `/wiki/`: `awk '$9>=500 && $7 ~ "^/wiki/"' /var/log/nginx/access.log \| tail` |
| Bot defense, fail2ban | step 10b; afterwards `/usr/local/bin/ixwiki-bot-defense.sh status`, `tail -f /var/log/ixwiki-bot-defense.log`, `fail2ban-client status ixwiki-bots` |
| PHP-FPM watchdog | step 10a; afterwards `tail -f /ixwiki/private/logs/php-fpm-watchdog.log` |
| Webhook | `pm2 logs wikios \| grep sync-webhook`; 401 means the two secrets differ, 503 means WikiOS has none |
| Discord DMs | disk alert, PHP-FPM watchdog and bot-defense alerts reach the admin through `ixwiki-notify.sh` |
| Disk | `df -h /` (WikiOS logs go to `/var/log/pm2/`, rotated at 50M x 5) |

### 10a. PHP-FPM watchdog: make it probe MediaWiki, not WikiOS (before step 8)

The watchdog (`/ixwiki/private/scripts/php-fpm-watchdog.sh`, service `php-fpm-watchdog`) restarts PHP-FPM when the
wiki answers HTTP 500. After the cutover `/wiki/*` is WikiOS, so a probe of `/wiki/Main_Page` would restart PHP-FPM
(and DM the admin) for WikiOS errors PHP-FPM cannot fix, and would stop noticing real MediaWiki failures. Its other
trigger, more than 50 `upstream prematurely closed` lines in 60 seconds of `/var/log/nginx/error.log`, stays valid.

```bash
grep -nE 'curl|https?://|Main_Page|/wiki/' /ixwiki/private/scripts/php-fpm-watchdog.sh     # find the probe URL
sudo cp -a /ixwiki/private/scripts/php-fpm-watchdog.sh /ixwiki/private/scripts/php-fpm-watchdog.sh.pre-wikios
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

**Rollback:** `sudo cp -a /ixwiki/private/scripts/php-fpm-watchdog.sh.pre-wikios /ixwiki/private/scripts/php-fpm-watchdog.sh && sudo systemctl restart php-fpm-watchdog`.

### 10b. Bot defense and fail2ban: stop counting static assets (before step 8)

The bot-defense daemon (`/usr/local/bin/ixwiki-bot-defense.sh`, 60 requests per minute per IP, set in
`/etc/ixwiki-defense.conf`) and the fail2ban jail `ixwiki-bots` (more than 60 requests per minute, one-hour ban) both
read the nginx access log. A cold WikiOS page load is one document plus dozens of `/_next/static/` chunks, fonts and
flag files, so a real reader who opens two articles in a minute can be blocked at the Cloudflare edge. Fix it in one
place, nginx, so every log consumer benefits: keep the static asset locations out of the access log.

```bash
sudo cp -a /etc/nginx/snippets/wikios-takeover.conf /ixwiki/private/backups/wikios-takeover.conf.pre-accesslog
sudo sed -i -E '/^location \^~ \/(_next|fonts|flags|maplibre|images\/flags|images\/wikios|wikios-|favicon-wikios)[^ ]* \{$/a\    access_log off;' /etc/nginx/snippets/wikios-takeover.conf
grep -c 'access_log off' /etc/nginx/snippets/wikios-takeover.conf        # must print 8 (run the sed once only)
sudo nginx -t && sudo systemctl reload nginx                               # in step 8, `nginx -t` alone is enough here
```

Trade-off: nothing is logged for those paths, so a flood of requests to them is invisible to the daemon and fail2ban
(Cloudflare still sees it at the edge). Dynamic paths (`/wiki/`, `/api/trpc/`, `/api/onoma/tts`) stay logged and counted.

If you would rather keep the log lines and raise the limits instead:

```bash
grep -niE 'ip' /etc/ixwiki-defense.conf                   # the per-IP requests-per-minute value (default 60)
sudoedit /etc/ixwiki-defense.conf                         # set it to 240
sudo systemctl restart ixwiki-bot-defense
sudoedit /etc/fail2ban/jail.d/ixwiki-bots.conf            # multiply the ixwiki-bots maxretry by 4 (same findtime)
sudo fail2ban-client reload
```

Check after the cutover, from a browser with a cold cache: open `https://ixwiki.com/wiki/Main_Page` and two more
articles within a minute, then

```bash
/usr/local/bin/ixwiki-bot-defense.sh status               # your IP must not be listed as blocked
fail2ban-client status ixwiki-bots                        # your IP must not be banned
```

If a reader is blocked: `sudo fail2ban-client set ixwiki-bots unbanip <ip>`, and remove the IP under Cloudflare,
Security, WAF, Tools (IP Access Rules).

**Rollback:** restore `/ixwiki/private/backups/wikios-takeover.conf.pre-accesslog` over the snippet (or the `/etc`
files you changed), `sudo nginx -t && sudo systemctl reload nginx`, restart `ixwiki-bot-defense`, `sudo fail2ban-client reload`.

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

Reverses step 8 only; WikiOS keeps running harmlessly on loopback:

```bash
# MediaWiki: article path back to /wiki/
#   in /ixwiki/config/LocalSettings.php re-add, above the require_once:
#       define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );
sudo cp /ixwiki/private/backups/ixwiki.com.pre-wikios /etc/nginx/sites-enabled/ixwiki.com
sudo nginx -t
sudo systemctl reload php8.4-fpm && sudo systemctl reload nginx
# then purge the Cloudflare cache for /wiki/* again (step 8)
curl -s -o /dev/null -w '%{http_code}\n' https://ixwiki.com/wiki/Main_Page      # MediaWiki again
```

(The files in `/etc/nginx/conf.d/` and `/etc/nginx/snippets/` are inert without the `include`; the `wikios-upstream.conf`
`map` and `upstream` are harmless.) To also stop WikiOS: `pm2 delete wikios && pm2 save`.

## Server-local files this cutover edits (none of them are in git)

| File | Edit | Step |
|------|------|------|
| `/ixwiki/public/projects/ixstats/next.config.js` | `resolveBasePath()` WikiOS branch; `rewrites()` early return; **remove the `/api/ixwiki-proxy` rewrite** | 5 |
| `/ixwiki/public/projects/ixstats/.env.production.local` | `WIKIOS_MEDIAWIKI_BOT_USER`, `WIKIOS_MEDIAWIKI_BOT_TOKEN`, `WIKIOS_MEDIAWIKI_INTERNAL_URL` | 3, 4 |
| `/ixwiki/public/wikios/ecosystem.wikios.config.cjs` | new, from the `.example` | 5 |
| `/etc/nginx/conf.d/wikios-render-internal.conf`, `wikios-upstream.conf` | new | 4, 8 |
| `/etc/nginx/snippets/wikios-proxy-params.conf`, `wikios-takeover.conf` | new | 8 |
| `/etc/nginx/sites-enabled/ixwiki.com` | `include` added; `/wiki/` location, `@mediawiki` `/wiki/` rewrite and any `location = /` removed | 8 |
| `/ixwiki/config/LocalSettings.php` | `require_once` of the snippet; `define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true )` added in step 6, removed in step 8 | 6, 8 |
| `/ixwiki/config/wikios-localsettings.php` | new, copy of the tracked snippet | 6 |
| `/etc/php/8.4/fpm/pool.d/www.conf` | `env[WIKIOS_WEBHOOK_SECRET]` | 6 |
| `/ixwiki/private/scripts/php-fpm-watchdog.sh` | probe URL `/classic/Main_Page` if it used `/wiki/` | 10 |

## Later

IxStates moves to ixstates.com (owner decision D11): then `NEXT_PUBLIC_IXSTATES_URL` changes, the WikiOS build is
redeployed, and classic MediaWiki moves to `classic.ixwiki.com`. When WikiOS serves its own `api.php`,
`/api.php` joins the WikiOS locations in `wikios-takeover.conf` and the matching row of
`verify-wikios-takeover.ts` changes.
