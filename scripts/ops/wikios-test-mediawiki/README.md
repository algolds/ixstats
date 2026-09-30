# WikiOS test MediaWiki (dev only)

A throwaway MediaWiki on SQLite that stands in for `https://ixwiki.com` while developing WikiOS, so no
WikiOS test has to touch the production wiki. It exists to exercise the private render engine
(`action=parse&text=`), the `wikios-mirror` bot account and the `PageSaveComplete` sync webhook.
**Never deploy this.** It binds to `127.0.0.1:8089` only.

## Start

```bash
./scripts/ops/wikios-test-mediawiki/setup.sh
```

First start: pulls `mediawiki:1.45`, generates random credentials into `.env.test-mediawiki` (gitignored,
mode 0600), runs the installer (SQLite), creates the admin account `WikiOSAdmin`, the bot account
`WikiOSMirror` (group `wikios-mirror`) and its bot password `WikiOSMirror@wikios`. Later starts are
idempotent. The script never prints a secret.

If the `1.45` tag is ever unavailable, change `image:` in `docker-compose.yml` to `mediawiki:lts`.

## What is loaded

| Piece | Setting |
|-------|---------|
| Skin | Vector |
| Extensions | ParserFunctions, Scribunto (`$wgScribuntoDefaultEngine = 'luastandalone'`), Cite, TemplateStyles, TemplateData, SyntaxHighlight_GeSHi (Pygments runs on the image's `python3`), Poem, PageImages, TextExtracts, Gadgets |
| Uploads / raw HTML | `$wgEnableUploads = true`, `$wgRawHtml = false` |
| Bot passwords | `$wgEnableBotPasswords = true` |
| Group `wikios-mirror` and the webhook hook | the production snippet `scripts/ops/mediawiki/wikios-localsettings.php`, mounted into the container and `require`d by `LocalSettings.php`, so the test wiki runs the same code the production `LocalSettings.php` will |
| Caches | off (parser, main, message), so every `action=parse` renders fresh |

`$wgArticlePath` stays at MediaWiki's default here (`WIKIOS_KEEP_WIKI_ARTICLE_PATH` is defined); the canonical
URL, the group and the webhook are live. The `ConfirmEdit` extension is not loaded, so the `skipcaptcha` right of
the group has no effect on this wiki.

## Point WikiOS at it

```bash
set -a; source scripts/ops/wikios-test-mediawiki/.env.test-mediawiki; set +a
# now WIKIOS_MEDIAWIKI_API, WIKIOS_MEDIAWIKI_INTERNAL_URL, WIKIOS_MEDIAWIKI_BOT_USER and
# WIKIOS_MEDIAWIKI_BOT_TOKEN point at http://127.0.0.1:8089
```

To try the sync webhook, start the container with `WIKIOS_WEBHOOK_SECRET` set (same value as
`WIKI_SYNC_WEBHOOK_SECRET` of the WikiOS under test):

```bash
WIKIOS_WEBHOOK_SECRET=<secret> docker compose --env-file .env.test-mediawiki up -d
```

The hook posts `{"title": "..."}` to `http://127.0.0.1:3560/api/wiki/sync-webhook` with the
`x-wiki-webhook-secret` header. That address is the container's own loopback, so a WikiOS running on the
host does not receive it; to watch the request, run a throwaway listener inside the container
(`docker compose --env-file .env.test-mediawiki exec mediawiki php -S 127.0.0.1:3560 router.php`, with a
`router.php` that logs the request) and save a page as `WikiOSAdmin`. Edits made by `WikiOSMirror` are
deliberately not announced (echo guard).

## Quick checks

```bash
curl -s 'http://127.0.0.1:8089/api.php?action=query&meta=siteinfo&format=json' | head -c 300
curl -s http://127.0.0.1:8089/api.php \
  --data-urlencode action=parse --data-urlencode format=json --data-urlencode contentmodel=wikitext \
  --data-urlencode 'text={{#expr:2+3}}'
```

## Stop / reset

```bash
docker compose --env-file .env.test-mediawiki down        # stop, keep the wiki
docker compose --env-file .env.test-mediawiki down -v     # stop and delete the database + uploads
rm .env.test-mediawiki                                    # only together with `down -v`: the passwords
                                                          # stored in the database would no longer match
```

`setup.sh` refuses to run when it had to regenerate `.env.test-mediawiki` but the database already exists.
