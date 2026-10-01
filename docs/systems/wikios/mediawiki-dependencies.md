# What still talks to MediaWiki, and why

Status: written for plan 418 ("retire MediaWiki read tethers"). Last full audit: 2026-09-30.

WikiOS owns IxWiki's pages. PostgreSQL holds every page, revision, link, category, image link, asset record, user
group and log entry (`wiki_articles`, `wiki_revisions`, `wiki_links`, `wiki_category_members`, `wiki_image_links`,
`wiki_template_links`, `wiki_assets`, `wiki_user_groups`, `wiki_logs`). MediaWiki is a **private render engine**, the
**mirror target** of WikiOS edits, the **source of edits made on classic MediaWiki**, the **proof of wiki-account
ownership**, the **host of uploaded file bytes**, and a neighbour: **sister wikis** (iiwiki, AltHistory, Commons) are other
people's wikis and are read where they live.

Nothing else may call an IxWiki MediaWiki. A read that is not on the list below goes to Postgres, and when
Postgres has nothing, the answer is "nothing", never a retry against MediaWiki.

This document is enforced: `src/tests/architecture/mediawiki-dependencies-doc.test.ts` fails when a source file that
names a MediaWiki endpoint (`getMediaWikiApiUrl`, the `config.ts` URL helpers `mediaWikiOrigin` / `mediaWikiApiUrl` /
`mediaWikiImageUrl` / `publicArticleUrl` / `isMediaWikiUrl` / `mediaWikiHostPattern`, `api.php`, `NEXT_PUBLIC_MEDIAWIKI_URL`,
`WIKIOS_MEDIAWIKI*`) is not mentioned here. Adding a call site means adding a row.

**One config object (plan 415, v1 decision D14).** The wiki's host, its endpoints and its name are read from the environment
once, in `src/lib/wiki-os/config.ts` (`wikiosConfig`, frozen). `NEXT_PUBLIC_MEDIAWIKI_URL` is the public origin (default
`https://ixwiki.com`, spelled nowhere else); `WIKIOS_MEDIAWIKI_INTERNAL_URL` is the loopback `api.php` every server-side call to
IxWiki's MediaWiki uses (`mediaWikiApiUrl({ internal: true })`, `getMediaWikiApiUrl("ixwiki")`); a URL a browser follows is built
from the public origin (`mediaWikiOrigin()`, `publicArticleUrl(title)`, `mediaWikiImageUrl(path)`). A link detector builds its regular
expression from the configured host (`mediaWikiHostPattern()`, `isMediaWikiUrl(url)`, `wikiTitleFromArticleUrl(url)`).

## Categories

| Category | Meaning |
| --- | --- |
| **render** | MediaWiki parses wikitext WikiOS sends it (`action=parse&text=`). It never renders `&page=` for content WikiOS owns, and never reads its own copy of a page. |
| **sync** | Inbound: edits and log events made on classic MediaWiki are imported (fast-forward or parked, plan 406). |
| **mirror** | Outbound: WikiOS edits are exported to MediaWiki in the background (plan 407). |
| **account-proof** | Reads that prove a person controls a wiki account, or who created a page. |
| **admin-refresh** | An operator presses a button; MediaWiki is the data source of that one action. |
| **media-bytes** | The bytes of an uploaded file live on the MediaWiki host; WikiOS proxies them. No wiki content. |
| **sister** | iiwiki, AltHistory, Commons: read from their own wikis; WikiOS holds no copy. |
| **import-script** | One-time or operator-run scripts, never on a request path. |
| **url-only** | The file builds a MediaWiki URL for a link or an image `src`; it makes no request. |

## 1. IxWiki call sites in `src/`

### render

| Call site | What it sends | Notes |
| --- | --- | --- |
| `src/lib/wiki-os/adapters/mediawiki/parsoid.ts` `renderArticleViaMediaWiki` | `action=parse&text=<Postgres wikitext>&title=` plus `prop=text\|links\|templates\|images\|categories\|properties\|displaytitle` | The render service's engine call (`services/render-service.ts`), once per revision, off the reader's path. Also the template preview's engine call (below). **Read path only for a page that was never rendered or is stale (plan 404).** Internal URL (`WIKIOS_MEDIAWIKI_INTERNAL_URL`) when configured. |
| `src/lib/wiki-os/services/render-service.ts` (`renderArticle`, `renderStaleBatch`) | the call above, for one article | Once per revision: after a save or an inbound edit, from the render queue and the `wiki-render-stale` job; or on a reader's first view of a page that was never rendered. At most two renders at once. |
| `src/lib/wiki-os/services/revision-view-service.ts` `getRevisionView` | the call above, for an **old revision's** Postgres wikitext | **On a read path:** `?oldid=` / a history diff view renders that revision on demand (one render per revision at a time, a limiter, the view remembered in the process; a revision of a deleted page is "missing" to a reader who may not see it). Falls back to the in-process compiler. |
| `src/lib/wiki-os/adapters/mediawiki/parsoid.ts` `wikitextToHtml` | `action=parse&text=&pst=1` | Editor "preview" (`wikios.previewWikitext`, signed-in). Falls back to the in-process compiler. |
| `src/lib/wiki-os/templates/template-engine.server.ts` `getTemplatePreview` | `renderArticleViaMediaWiki({{name\|k=v}})` | The template inserter's preview, server-only (`server-only`): the editor reaches it through the tRPC route `wikios.getTemplatePreview` (signed-in, rate-limited, sanitised, Redis-cached in `templates/preview-service.server.ts`). A browser never calls it. Falls back to the in-process compiler. |
| `src/lib/wiki-os/api-compat/deps.ts` (`renderWikitext`) | `renderArticleViaMediaWiki(<text or old revision's wikitext>)` | WikiOS's own `/w/api.php` (plan 410): `action=parse&text=` from a bot session, or `parse&oldid=` (20/min per IP). Never the in-process compiler: a failed render answers `renderunavailable`. |
| `src/server/api/routers/wikios/page-content.ts` `getArticleHtml` (sister branch) | `action=parse&text=<sister wiki's wikitext>` to IxWiki's engine (`WIKIOS_MEDIAWIKI_API`) | A sister wiki's page (`?source=iiwiki`) is fetched from its wiki and rendered by IxWiki's engine. Never used for an IxWiki page. |

### sync (inbound)

| Call site | What it reads | Notes |
| --- | --- | --- |
| `src/lib/wiki-os/services/inbound-mediawiki.ts` `mediaWikiGet` | `list=recentchanges`, `list=logevents`, `prop=revisions` | The only inbound HTTP client. |
| `src/lib/wiki-os/services/auto-sync-service.ts`, `src/lib/wiki-os/services/inbound-revision-sync.ts` | the above | `wiki-recentchanges` cron job, the `/api/wikios/inbound-sync` and `/api/wiki/sync-webhook` webhooks. `inbound-revision-sync.ts` also re-pushes WikiOS's head after parking a conflicting edit (mirror). |
| `src/lib/wiki-os/services/article-view-service.ts` (via `syncSinglePage`) | one page's newest revision | **On a read path (plan 412):** a request for a page Postgres has no row for imports it from MediaWiki once, so a page created on classic MediaWiki before the next sync cycle is not a 404. Budgeted: one import per title at a time, one try per title per minute, and a limiter shared by the process. |

### mirror (outbound, plan 407)

| Call site | What it does |
| --- | --- |
| `src/lib/wiki-os/adapters/mediawiki/write-service.ts` `executeMediaWikiWrite` | A write with the bot session: `action=edit` (the export queue) and `action=upload` (`wikios.uploadFile`). |
| `src/lib/wiki-os/adapters/mediawiki/csrf-cache.ts` | Bot login and CSRF token. |
| `src/lib/wiki-os/adapters/mediawiki/sync-worker.ts` | The background queue behind both (`SKIP_MEDIAWIKI_SYNC=true` stops it). Callers: `src/server/api/routers/wikios/editing.ts`, `inbound-revision-sync.ts`. |

### account-proof

| Call site | What it reads | Callers |
| --- | --- | --- |
| `src/lib/wiki-os/adapters/mediawiki/account-proof.ts` `fetchWikiUser`, `fetchUserPageHistory`, `fetchPageCreator`, `wikiQuery` | `list=users`, a user page's revisions with their authors, a page's first revision | The self-service wiki-link proof (`ixnayid/linking.ts`, `modules/identity/identity.wiki-links.ts`), the admin link (`admin/users.ts`), realm claims (`modules/realms/realms.claims.ts`, `routers/realms/index.ts`), and the admin link of an account WikiOS has no trace of or whose MediaWiki id it cannot know (`src/lib/wiki-os/adapters/ixstates/user-sync.ts` `findLinkableWikiAccount`: `fetchWikiUser`, admin-triggered). Also reads iiwiki and AltHistory accounts. |

### admin-refresh

| Call site | What it reads | Caller |
| --- | --- | --- |
| `src/lib/wiki-os/templates/template-engine.server.ts` `fetchTemplateData` | `action=templatedata` | `routers/admin/wiki.ts` `syncWikiTemplateByName` and `syncWikiTemplatesByCategory`, by an admin. A reader's TemplateData is read from Postgres (`templates/template-data-reader.ts`). |

### media-bytes

| Call site | What it fetches | Notes |
| --- | --- | --- |
| `src/app/api/mediawiki/ixwiki/[...path]/route.ts`, `src/app/api/mediawiki/_media-response.ts` | `images/...`, `images/thumb/...`, `Special:FilePath/<name>`, `thumb.php?f=<name>&width=<n>` | Image-only proxy (image/* only, 15 MB cap). Rate-limited. Registers the file in `wiki_assets` on first sight. This is a file download, not a wiki read: the bytes of an uploaded file are not in Postgres. |
| `src/app/api/_lib/image-proxy.ts`, `src/app/api/download/external-image/route.ts` | allow-listed external image hosts (ixwiki.com among them) | Generic image download proxy. |
| `src/app/api/mediawiki/[wiki]/[...path]/route.ts` | the same shapes, for iiwiki, AltHistory and Commons | Sister wikis (below). |

### Public `api.php` proxy (IxWiki: closed)

| Call site | What it does |
| --- | --- |
| `src/app/api/mediawiki/[wiki]/api.php/route.ts`, `src/app/api/mediawiki/_config.ts` | Read-only proxy of a wiki's `api.php` for outside callers. **IxWiki's `allowedActions` is `[]`: the route answers 410 and asks no wiki** (WikiOS serves `/w/api.php` itself, plan 410, and the proxy could return a page WikiOS has deleted; no WikiOS code called it). It still forwards `query`/`opensearch`/`parse` for the sister wikis (below). |

### WikiOS's own `/w/api.php` (served, never called)

These files implement or link to the MediaWiki-compatible API that WikiOS **serves** (plan 410). They name `api.php` /
`index.php` because they produce MediaWiki's wire format, and send no request to any MediaWiki (the one render call is
`api-compat/deps.ts`, listed under render above):
`src/app/w/api.php/route.ts`, `src/app/(wiki-os)/util/botpasswords/page.tsx`, `src/server/api/routers/wikios/bot-passwords.ts`,
`src/server/api/routers/wikios/index.ts`, `src/lib/wiki-os/services/edit-service.ts`,
`src/lib/wiki-os/api-compat/actions.ts`,
`src/lib/wiki-os/api-compat/auth-store.ts`,
`src/lib/wiki-os/api-compat/auth.ts`,
`src/lib/wiki-os/api-compat/bot-passwords.ts`,
`src/lib/wiki-os/api-compat/dispatch.ts`,
`src/lib/wiki-os/api-compat/error-map.ts`,
`src/lib/wiki-os/api-compat/errors.ts`,
`src/lib/wiki-os/api-compat/format.ts`,
`src/lib/wiki-os/api-compat/main-params.ts`,
`src/lib/wiki-os/api-compat/modules/page-ops.ts`,
`src/lib/wiki-os/api-compat/modules/query-meta.ts`,
`src/lib/wiki-os/api-compat/modules/query-prop.ts`,
`src/lib/wiki-os/api-compat/params.ts`,
`src/lib/wiki-os/api-compat/registry.ts`,
`src/lib/wiki-os/api-compat/store-lists.ts`,
`src/lib/wiki-os/api-compat/store-types.ts`,
`src/lib/wiki-os/api-compat/store.ts`,
`src/lib/wiki-os/api-compat/types.ts`.

### url-only (no request)

`src/lib/wiki-os/config.ts` (`wikiosConfig` and the URL helpers), `src/env.ts` (the environment variables),
`src/lib/wiki-os/transformers/image-url.ts` and `src/lib/wiki-os/transformers/html-transformer.ts` (image and link URLs),
`src/lib/wiki-os/core/media-asset-service.ts` (an asset's canonical file URL), `src/lib/cards/lore-card-ixwiki.ts` (the file
URL of a lead picture with no asset row), `src/lib/system/wikios-standalone.ts` (the paths WikiOS's own host serves, among them
`/api.php`), `src/lib/wiki-os/guardian/cloudflare-guardian.ts` (the origin of a Cloudflare cache purge; the request goes to
Cloudflare), `src/components/maps/core/MapWelcomeModal.tsx` (a link).

A browser calls none of this: `src/tests/architecture/browser-mediawiki.test.ts` fails if client code imports a module that
calls MediaWiki or names a MediaWiki URL helper. `src/lib/wiki-os/templates/template-registry.ts` (types and pure helpers) is
client-safe; the render-engine and refresh calls are in the server-only `template-engine.server.ts`.

## 2. Sister wikis (iiwiki, AltHistory, Commons)

Read from their own wikis by design. A sister wiki's title is never tried on IxWiki and an IxWiki title is never tried on a
sister wiki (`getPageImages` used to try iiwiki for any title).

| Call site | What it reads |
| --- | --- |
| `src/lib/wiki-os/adapters/mediawiki/bridge/http-reader.ts` | wikitext, search, category members, page images and page authors of iiwiki and AltHistory; Commons category members and file URLs. |
| `src/lib/wiki-os/adapters/mediawiki/bridge/batch-reader.ts` | batched wikitext of iiwiki and AltHistory (through `http-reader.ts`). |
| `src/server/api/routers/wikios/categories.ts`, `src/server/api/routers/wikios/search.ts` | the `wiki: "iiwiki" \| "althistory"` branch of `searchCategories`, `getCategories`, `getCategoryTotalCounts`, `getSubcategories`, `autocompleteCategories`, `searchFiles`. |
| `src/lib/cards/lore-card-generator.ts` | every generator read for iiwiki (article data, previews, authors, category members, category search and info, main-namespace pages, random pages, file URLs). |
| `src/server/api/routers/lore-cards/wiki.ts` | iiwiki's opensearch fallback and recent changes. |
| `src/lib/wiki-os/adapters/ixstates/eligible-country-service.ts` | iiwiki and AltHistory country lists and pages. |
| `src/lib/flags/flag-resolver.server.ts` | iiwiki flag `imageinfo`. |
| `src/server/api/routers/commons.ts`, `src/server/services/wikimedia-equipment-image-resolver.ts` | Commons search and file URLs. |

### Files that only build or recognise an IxWiki address (no request to MediaWiki)

`src/tests/architecture/mediawiki-dependencies-doc.test.ts` also matches the `config.ts` URL helpers and the literals
`ixwiki.com`, `index.php` and `rest.php`. None of these files calls IxWiki's MediaWiki; the address comes from the one
configuration object, never from a literal:

- **Links and display URLs** to public IxWiki pages and files, built into an `href` or text (`publicArticleUrl`, `mediaWikiImageUrl`,
  `isMediaWikiUrl`): `src/app/(wiki-os)/util/repository/page.tsx`,
  `src/app/(wiki-os)/util/search/page.tsx` (a link to WikiOS's own `/wiki/index.php` compatibility path),
  `src/app/admin/cards/LoreCardBatchAdmin.tsx`, `src/components/cards/display/CardDetailsModal.tsx`,
  `src/components/mycountry/dossier/dossier/WikiSectionCard.tsx`, `src/components/wiki-os/commons/CommonsDetailPanel.tsx`,
  `src/components/wiki-os/margin/modals/MarginShareModal.tsx`, `src/components/wiki-os/margin/tabs/MarginMarkupTab.tsx`,
  `src/components/wiki-os/media-search/WikiRepositoryTab.tsx`, `src/components/wiki-os/reader/ImageLightbox.tsx`, `src/components/wiki-os/reader/ImageLightboxModal.tsx`,
  `src/hooks/useDossier.ts`, `src/lib/wiki-os/xml/export-writer.ts` (the dump's `siteinfo`), `src/lib/wiki-os/sitemap-xml.ts`,
  `src/lib/wiki-os/wiki-path.ts`, `src/server/modules/identity/identity.vault.ts`.
- **Detectors of a link to an IxWiki page** in stored or fed text, built from the configured host (`mediaWikiHostPattern`,
  `wikiTitleFromArticleUrl`), so they keep matching the old absolute links: `src/components/dashboard/sections/TrendingSectionWidget.tsx`,
  `src/components/dashboard/sections/UnifiedFeedItem.tsx`, `src/components/dashboard/sections/feed/FeedItemHeader.tsx`,
  `src/components/thinkpages/post/PostInlineLinkPreview.tsx`, `src/components/wiki-os/shared/GlobalLinkTooltipProvider.tsx`,
  `src/lib/cards/ns-image-proxy.ts`, `src/lib/forum/forum-utils.ts`, `src/lib/wiki-os/main-page/featured-article.ts`.
- **Static files on the MediaWiki host loaded by a browser as an image `src`** (media-bytes, no API): `src/components/thinkpages/AccountCreationModal.tsx`,
  `src/lib/sports/transition.ts`.
- **URL rewriting and referrer comments**: `src/app/(wiki-os)/wiki/layout.tsx`, `src/lib/wiki-os/transformers/fix-editor-images.ts`,
  `src/lib/wiki-os/transformers/resolve-highres-image.ts`.
- **`User-Agent` strings** sent to other services: `src/lib/demo-seed/sports/sports-helpers.ts`, `src/lib/discord/ixtwitter-sync.ts`,
  `src/lib/discord/thinkpages-feed.ts`, `src/lib/nationstates/api-client.ts`, `src/server/cron/validate-equipment-images.ts`.
- **Other hosts under ixwiki.com that are not MediaWiki.** The forum (`forum.ixwiki.com`, XenForo):
  `src/app/api/forum/attachment/[id]/route.ts`, `src/app/api/forum/user-cards/route.ts`, `src/components/settings/ForumAccountVerify.tsx`,
  `src/server/api/routers/forum/reading.ts`, `src/server/api/routers/forum/writing.ts`, `src/server/modules/forum/lib/bbcode-transformer.ts`,
  `src/server/modules/forum/services/xenforo-service.ts`, `src/proxy.ts` (frame ancestors). Accounts (`accounts.ixwiki.com`, Clerk):
  `src/components/navigation/UserProfileMenu.tsx`, `src/components/settings/IxnayIDCard.tsx`, `src/lib/security/csp.ts`. Maps
  (`maps.ixwiki.com`): `src/app/maps/page.tsx`, `src/lib/system/standalone-detection.ts`, `src/lib/utils/slug-utils.ts`,
  `src/components/wiki-os/shared/GlobalLinkTooltipProvider.tsx`. IxStates itself (`ixwiki.com/projects/ixstates`):
  `src/app/_components/splash/SplashThinkPagesPeek.tsx`. An example document URL (`archives.ixwiki.com`) in template presets:
  `src/lib/wiki-os/templates/master-presets.ts`, `src/server/api/routers/wikios/templates.ts`.

## 3. Scripts (operator-run, outside `src/`)

Never on a request path: `scripts/sync-ixwiki-live.ts`, `scripts/sync-ixwiki-media.ts`, `scripts/wikios-fetch-export.ts` (with
`src/lib/wiki-os/xml/fetch-dump.ts`: an export-0.11 dump through the Action API), `scripts/wikios-import-rights.ts`,
`scripts/audit/*` and `scripts/audit-wikios-parity.ts` (parity audits against live MediaWiki), `scripts/bench/wikios-bench.ts`,
`scripts/ops/verify-wikios-takeover.ts`, `scripts/deployment/*`, and the archived migrations under `scripts/archive/`.

## 4. What plan 418 moved to Postgres

| Was (MediaWiki) | Now (Postgres) | Where |
| --- | --- | --- |
| live `prop=revisions` on a Postgres miss (`ixwikiGetWikitext`, `ixwikiGetNamespacedWikitext`) | `wiki_articles` only; a stub, a deleted or a missing page is "not found" | `bridge/pg-reader.ts`, `adapters/mediawiki/article-store.ts` |
| creator, last editor and contributors from `prop=revisions` (last 250 only), `getArticleAuthors` | `wiki_revisions` without parked rows: creator = oldest, last editor = newest, contributors by edit count then name, IP authors folded into "Anonymous" | `core/revision-authors.ts` |
| `list=recentchanges`, full history, `list=usercontribs`, `list=users` | `wiki_revisions` (contributions also by the verified owner's `authorId`), created pages = pages whose oldest live revision the account made, user info from revisions, the verified link and the rights engine | `bridge/pg-activity.ts`, `core/wiki-user-info.ts` |
| `prop=images\|imageinfo` on ixwiki and then iiwiki for any title | `wiki_image_links` joined to `wiki_assets` (sister wikis for their own pages only) | `bridge/pg-site.ts`, `bridge/dispatchers.ts` |
| `allcategories`, `categoryinfo`, `categorymembers`, `allimages` | `wiki_categories`, `wiki_category_members` (counts by member namespace), `wiki_assets` | `core/category-service.ts`, `core/media-asset-service.ts`, `routers/wikios/{categories,search}.ts` |
| the lore-card generator's multi-prop queries, opensearch fallback | text, links, categories, images and revisions from Postgres | `src/lib/cards/lore-card-ixwiki.ts`, `routers/lore-cards/wiki.ts` |
| the Lorewards sync's OOL page fallback | the WikiOS article | `src/lib/lorewards/sync.ts` |
| `action=templatedata` on a `wiki_templates` miss | the `<templatedata>` block of the stored template page or its `/doc` | `templates/template-data-reader.ts` |
| lead images stored as a proxy path under the deployment's base path | the canonical `/images/<shard>/<File>` path, resolved when read | `transformers/image-url.ts` (`extractLeadImagePath`, `resolveStoredImageUrl`) |

Already gone before 418, checked: the `getArticleHtml` Main Page `action=parse&page=Main_Page` branch (plans 404, `1a720deae`,
`a9ad32704`), the HTTP fallback of `getArticleHtml`, redirects (Postgres only since plan 402).

## 5. Where a user's read can still reach an IxWiki MediaWiki

1. A page that was never rendered, or whose render is stale, is rendered once by the engine (plan 404); the reader gets the
   previous view or the local compile meanwhile.
2. An old revision (`?oldid=`, a history view) is rendered on demand by the engine (`revision-view-service.ts`), once per
   revision while it is remembered.
3. A request for a page Postgres has no row for imports it once from MediaWiki (plan 412, budgeted).
4. Image bytes (the media proxy): not wiki content.
5. Editing: the editor preview and the template preview (both rendered on the server).
6. A sister wiki's page.

## 6. Open items found by the audit (not changed by plan 418)

- **`scripts/sync-ixwiki-full.ts` and `scripts/sync-ixwiki-live.ts`** import `../src/lib/wiki-os/transformers/excerpt`, a
  module that no longer exists; they do not run.

## How to re-check

```bash
grep -rn "getMediaWikiApiUrl\|mediaWikiApiUrl\|api\.php" src --include=*.ts --include=*.tsx | grep -v "^src/tests"
grep -rlE "DEFAULT_MEDIAWIKI_URL|NEXT_PUBLIC_MEDIAWIKI_URL|WIKIOS_MEDIAWIKI|IXWIKI_LOCAL_PATH" src --include=*.ts --include=*.tsx | grep -v "^src/tests"
bun run test -- src/tests/architecture/mediawiki-dependencies-doc.test.ts --maxWorkers=1
```

Every hit must be a row above. The "no fetch" tests of plan 418 (`src/tests/**/*no-mediawiki*.test.ts`,
`src/tests/**/mediawiki-tethers-*.test.ts`, `src/tests/lib/cards/lore-card-ixwiki.test.ts`) install a `fetch` that records and
rejects any request to IxWiki (`src/tests/helpers/fetch-guard.ts`) and assert there was none.
