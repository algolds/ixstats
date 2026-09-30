# Platform audit: WikiOS, Stash, Onoma, Narrator

Branch `rose-garden` @ `e91e6b0b2` (2026-09-30). Read-only audit: nothing was changed or run against a database.
Where the code and the docs disagree, the code wins. Row counts in the docs (4,685 articles, 48,200 links,
7,555 assets) could not be checked because there was no database access. They are marked *unverified*.

Paths are relative to the repo root. `lib/` means `src/lib/`, `routers/` means `src/server/api/routers/`.

---

## 0. Summary

1. **WikiOS today is a MediaWiki front-end with a Postgres copy of the content, not a replacement.** Postgres stores
   wikitext, revisions, links, categories, watchlists, Margin threads and Stash. **MediaWiki still does every
   template, parser-function and Lua expansion, all uploads and image hosting, the canonical URL for SEO, per-view
   author data, and the source of category membership.** The reader cannot even show a WikiOS edit until MediaWiki
   holds the same text (§3.2, NEW-2). If you set `SKIP_MEDIAWIKI_SYNC=true`, WikiOS edits never render.
2. **The owner's goal ("100% MediaWiki compatible, seamless transition") has no code path yet.** There is no XML
   import or export and no `api.php`-compatible surface. The only migration tool,
   `scripts/archive/migrations/wiki/migrate-mediawiki.ts`, is archived and broken: it imports the deleted `mysql-pool`,
   and its header advertises `--xml`, which is not implemented. "Full parser independence" was explicitly rejected in
   `docs/systems/wikios/wikios-independence-2b-3.md:88-89`. The documented end state is "headless MediaWiki behind
   WikiOS".
3. **The code audit's WK findings (WK-2 to WK-7, WK-16, WK-19) are all still open.** This audit adds **14 findings
   that are not in the code audit** (§7). Four matter most:
   - **NEW-1 (security):** every WikiOS edit goes to MediaWiki under one bot password, which defaults to `Heku@WikiOS`
     in `src/env.ts:92`. Any signed-in IxStates user can therefore push edits to any title, protected ones included,
     with that account's rights.
   - **NEW-2 and NEW-3 (correctness):** the reader serves stale HTML after edits made on MediaWiki, and it can
     permanently cache the *pre-edit* HTML right after a WikiOS save.
   - **NEW-4 (correctness):** each WikiOS edit comes back through the sync as a duplicate revision credited to the bot.
   - **NEW-5 (performance):** every article view makes a blocking MediaWiki HTTP call (8 s timeout) for author data.
4. **Stash is not a WikiOS subsystem in practice.** It has six consumers across five apps (WikiOS, Forum, Onoma,
   Messages, Lore Cards) plus Dashboard and Halo. Its schema lives in `wiki.prisma`, and its router is split across
   four files. The shared image picker (`components/wiki-os/media-search/MediaSearchModal.tsx`) is used by 10 non-wiki
   surfaces. **Recommendation: make Stash and the media repository platform services (data plus API).** Facet then
   ships only their UI parts. Neither belongs *in* Facet (a design system) or *in* WikiOS.
5. **Onoma is the most separable product in the repo.** `lib/onoma` has 8.5k lines of TypeScript with only two
   imports from outside itself, and generation runs in the browser. **Narrator is really three separate things.** The
   LLM "AI Narrator" has **no production caller** since plan 312 deleted `getFlavorText` and `flavorization.ts`; it is
   an admin playground. "Getting Narrator right" means rebuilding the production path (§5.3).

---

## 1. Inventory

Status legend:

- **Working**: wired end to end.
- **Partial**: works, with material gaps.
- **Stub**: fake or placeholder.
- **Dead**: no caller, or cannot run.
- **Broken**: wired, but fails.

Size: WikiOS is `lib/wiki-os` 18.3k lines, `components/wiki-os` 34.1k lines, app routes 5.4k lines, routers 4.8k lines
and wiki styles 12.3k lines, about **75k lines** in total.

### 1.1 WikiOS subsystems

| Subsystem | Status | Paths | Evidence |
|---|---|---|---|
| Postgres article store (`WikiArticle`, `WikiRevision`) | **Working** | `lib/wiki-os/core/article-repository.ts` (352), `prisma/schema/wiki.prisma:22-119` | Saves run in one transaction: upsert, then revision (`article-repository.ts:141-247`). `contentHtml` is always written as `""` on save (`:126`). `parentRevisionId`, `currentRevId` and `htmlSyncedAt` are never written (grep: 0 writers). |
| Reader rendering | **Partial (depends on MediaWiki)** | `routers/wikios/page-content.ts:50-390`, `adapters/mediawiki/parsoid.ts` | Uses `contentHtml` if it exists. Otherwise it calls **MediaWiki `action=parse&page=`**, which renders MediaWiki's stored copy, not the Postgres wikitext (`page-content.ts:177-200`). The in-process fallback `parseWikitextToHtml` is regex-based and expands no templates (`transformers/wikitext-parser.ts`, 585 lines). The Main Page always comes from MediaWiki (`parsoid.ts:35-60`). The page is a client component (`wiki/[slug]/page.tsx:1` is `"use client"`). |
| Native ParserFunctions | **Dead** | `core/parser-functions.ts` (68) | Only referenced by `src/tests/lib/wiki-os/core-domain.test.ts`. Not used on any render path. |
| Source editor (CodeMirror 6) | **Working** | `components/wiki-os/editor/WikiSourceEditor.tsx` (478) | |
| Visual "Canvas" editor (Plate) | **Working** | `editor/plate/PlateWikiEditor.tsx` (681), `transformers/wiki-ast-converter.ts` (695), `editor/plate/wiki-wikitext.ts` | Runs wikitext → WikiAST → Plate → wikitext. Unknown templates are kept as atomic blocks. The "canvas" is this block editor; there is no free-form spatial canvas. |
| Templates: search, TemplateData, preview, presets | **Partial** | `routers/wikios/templates.ts` (1,298 lines, 3 procedures), `lib/wiki-os/templates/*` | Previews go through MediaWiki `action=parse`. TemplateData comes from the `WikiTemplate` table (synced from MediaWiki by the admin in `routers/admin/wiki.ts:427-517`) or from `action=templatedata`. |
| IxStates data templates (`MyCountry:`, `CountryData:`, `BusinessData:`) | **Working (plugin seam)** | `lib/wiki-os/templates/template-resolver.ts`, `server/shared/ixstats-template-provider` | Registered through `registerTemplateProvider(ixstatsTemplateProvider)` (`page-content.ts:39`). This is the right seam for packaging. |
| MediaWiki export (outbound) | **Partial** | `adapters/mediawiki/sync-worker.ts` (106), `write-service.ts` | The queue is in memory and dropped after 3 retries (`sync-worker.ts:95-104`). All edits use the bot session: `getUserSessionAndToken` ignores its context and returns the bot session (`csrf-cache.ts:126-134`). `updateRevisionActor` is a no-op (`write-service.ts:36-39`). |
| MediaWiki sync (inbound) | **Partial** | `services/auto-sync-service.ts` (485), cron `wiki-recentchanges` every 10 min (`server/cron/jobs.ts:182`), `/api/wikios/inbound-sync`, `/api/wiki/sync-webhook` | Pulls namespaces `0\|1\|2\|4\|10\|14` (`:367`). It does **not** clear `contentHtml` (`:216-247`), so the reader goes stale (NEW-2). It skips a change only when a revision with that `mwRevId` already exists (`:420-432`), so WikiOS's own exports return as duplicates (NEW-4). Categories are only ever added, never removed (`:280-312`). |
| Revisions, history, diff, rollback | **Working (with gaps)** | `routers/wikios/history-diff.ts`, `transformers/wikitext-diff.ts` (client-side diff), `editing.ts:138-240` | Revert and rollback skip the edge-cache purge (WK-16). There is no edit-conflict check (WK-2): `basetimestamp` is accepted at `editing.ts:89` and never read. |
| Uploads | **Broken** (WK-5) | `editing.ts:244-303` | The base64 bytes are only size-checked. `action=upload` is posted with no `file`, `url` or `filekey`, so MediaWiki rejects it. A phantom `wiki_assets` row has already been written by then. |
| Image repository (`wiki_assets`, `/util/repository`) | **Partial (index plus proxy)** | `core/media-asset-service.ts` (285), `app/api/mediawiki/ixwiki/[...path]/route.ts`, `util/repository/page.tsx` (664) | Stores metadata only. `url` points at `ixwiki.com/images/…`. `md5Hash` is the MD5 of the **filename** (MediaWiki's shard path), not of the content (`media-asset-service.ts:55`), so there is no content dedup. The proxy keeps up to 500 media `ArrayBuffer`s in process memory (`route.ts:13-16`). BlurHash is derived from the filename (WK-17). |
| Search | **Partial** | `core/native-search-service.ts` (341), `routers/wikios/search.ts` | Tier 1 is Prisma `contains` (`:58`), not trigram. Tier 2 is `to_tsvector` computed per query over the title, summary and first 3,000 characters of wikitext (`:129-145`). There is no GIN index on `wiki_articles`. `searchFiles` and `searchCategories` fall back to live MediaWiki (`search.ts:266-285`, `categories.ts:245-260`). |
| Categories | **Partial** | `core/category-service.ts`, `routers/wikios/categories.ts` | Membership comes only from regex-matched literal `[[Category:]]` tags (`auto-sync-service.ts:280`). Categories added by templates are missed. **WikiOS saves never update categories** (`link-graph-service.ts:34` skips `Category:`). |
| Portals and Main Page | **Partial** | `components/wiki-os/reader/WikiOSMainPage.tsx` | The Main Page HTML is MediaWiki's. There is no realm portal (ROADMAP line 212 is still pending). |
| Protection | **Stub** (WK-3) | `lib/wiki-os/auth.ts:104-115` | The check exists, but nothing ever sets `protectionLevel`, and protection is not synced from MediaWiki. "Wiki admin" means `isSystemOwner` only (`auth.ts:85`). |
| Move, archive, delete | **Dead** (WK-7) | `core/page-management-service.ts:32,140` | No router calls it. `restoreArticle` is exposed (`editing.ts:307`) but there is no archive to restore from. |
| Watchlist | **Partial** (WK-19) | `watchlist-annotations.ts:115-330` | Watch, unwatch and feed work. Watchers are never notified. |
| Margin (threads, markup) | **Partial** | `components/wiki-os/margin/*` (3.5k lines), `routers/wikios/discussions.ts` | Threads are stored natively in Postgres (`WikiDiscussionThread`). There is no Stash tab, the Inspect tab is hidden, and comments cannot be deleted or reacted to (`wikios-margin-spec.md:251`). MediaWiki Talk pages (namespace 1) are synced in, but Margin never shows them, so there are two talk systems. |
| Stash | **Partial** (WK-11, WK-13) | `routers/wikios/stash.ts` (240), `forum/stash.ts`, `onoma/namebank.ts`, `admin/stash.ts`, `app/stashes`, `components/wiki-os/stashes` | See §6. Share links are not read. The admin limit is hard-coded to 25. |
| Security edge (Turnstile, CDN purge) | **Turnstile is inert** (WK-4); **purge is partial** | `guardian/cloudflare-guardian.ts` | The Turnstile result is ignored (`editing.ts:95-97`), and no client sends a token. |
| Multi-wiki reading (iiwiki, althistory) | **Working** | `bridge/http-reader.ts` (675) | Read-only. Foreign wikitext is rendered through **IxWiki's** `action=parse`, so the foreign wiki's templates resolve against IxWiki's templates (`page-content.ts:66-70`, which says so). |
| Lorewards and awards | **Working** (WK-8, WK-9) | `routers/lorewards/*`, `lib/lorewards` | Out of scope here, but it lives in `wiki.prisma`. |
| Export | **Partial** (WK-15) | `app/api/wiki/export/route.ts` | Exports Markdown or JSON for one article. There is no XML dump. |
| Admin | **Partial** | `routers/admin/wiki.ts` (582), `/admin` panels | Template sync, award and cache tools. No protection, rights, block or move tools. |
| Standalone host mode | **Not built for WikiOS** | `lib/system/standalone-detection.ts` | A hostname-based standalone mode exists for maps (`maps.ixwiki.com`). It is a ready pattern for a wiki-only host. |

### 1.2 Onoma (roadmap phases 1–10)

Onoma is `lib/onoma` (8.5k lines of TypeScript plus committed JSON lexicons, e.g. `person.json` at 100 KB), `app/labs/onoma` (74 files, 23.1k lines), `routers/onoma`
(2.3k lines, 38 procedures) and 12 Prisma models in `prisma/schema/onoma.prisma`. There are 18 tests.

| Phase | Doc claim | Code reality |
|---|---|---|
| 1. Foundation | Done | **Confirmed.** `markov-chain.ts` (408), `name-generator.ts`, `lexicon/culture-classifier.ts`, and committed lexicons in `data/lexicon/*.json`. |
| 2. Corpus intelligence | Done | **Confirmed.** `lexicon-analytics.ts` (214) and `MarkovVisualizer.tsx`. |
| 3. Linguistics engine | Done | **Confirmed.** `phonology.ts` (623), `morphology.ts` (340), `orthography.ts` (190). |
| 4. Living languages | Partial | **Confirmed.** `sound-shifts.ts` (411) and loanwords (`routers/onoma/loanwords.ts`). There is no timeline slider or family tree. |
| 5. ML layer | Partial | **Confirmed.** `perplexity.ts` (100) and `comparator.ts` (158). There are no embeddings. |
| 6. AI linguist | Not started | **Confirmed.** No LLM call exists anywhere in `lib/onoma`, `routers/onoma` or `labs/onoma`. The manual etymology CRUD works. |
| 7. Voice | Done | **Working, but restricted.** `/api/onoma/tts` requires sign-in, and then owner, admin or beta role (`route.ts:~120-160`). Everyone else falls back to browser `speechSynthesis`. The voice guide omits this restriction. |
| 8. Translation | Partial | **Confirmed.** Template S/V/O builder only (`syntax.ts`). |
| 9. Language Studio | Partial | **Confirmed.** Glyph forge and fork work. **There is no publish path for packs (SL-18)**, so the marketplace can only list and fork seeded packs. |
| 10. Onoma AI | Not started | **Confirmed.** |
| Platform integration | "Mostly not started" | **Confirmed.** Worldgen uses `markov-naming.ts` and `language-families.ts` (via `routers/geo/editor/procedural.ts`). NPCs, demonyms and toponyms are not wired. |

All 12 Onoma models have callers (grep counts: `nameBank` 19, `languagePack` 8, `etymologyRoot` 6, and so on). Note:
"saved names" are stored as **Stash** items (`contentType: "name" | "dictionary"`, JSON packed into `StashItem.note`,
`routers/onoma/namebank.ts:33-36, 271-345`), not in `NameBank` alone.

### 1.3 Narrator (three unrelated things share the name)

| Thing | Status | Paths | Evidence |
|---|---|---|---|
| **Wiki Narrator** (article read-aloud: Kokoro TTS with browser fallback, in Halo) | **Working, restricted** | `hooks/useWikiNarrator.ts` (809), `hooks/narrator/*`, `components/halo/plugins/wiki/components/WikiNarratorPlayer.tsx` (661), `/api/onoma/tts` (506) | Prefetches N+1 and N+2 sentences. Kokoro is limited to owner, admin and beta users. Everyone else gets `speechSynthesis` (`useWikiNarrator.ts:514-531`). |
| **AI Narrator** (LLM "flavor text" over canon context) | **Dead in production; admin playground only** | `lib/narrator/{client,canon-context,constants}.ts`, `routers/narrator/index.ts` (291, all `adminProcedure`), `app/admin/narrator/*` | Plan 312 (`cc12cf122`) deleted the only user-facing procedure, `getFlavorText`, and `flavorization.ts` was deleted later (`9ac5e8f14`). `getCacheStats` and `clearCache` operate on `flavor:` cache rows that nothing writes any more. The key is now masked (`378b224f8`). |
| **Sports commentary narrator** | Separate | `lib/sports/commentary/narrator.ts` | Has its **own copy** of `queryLLM`, with an SSRF guard. The Narrator client silently falls back to `sports:llm:*` keys and `SPORTS_LLM_*` env vars (`lib/narrator/client.ts:17-80`). |

---

## 2. Docs vs code

| Doc (file:line) | Claim | Reality (code) |
|---|---|---|
| `docs/systems/wikios.md:26-27`, `WIKIOS.md:13-14`, `(wiki-os)/README.md:8` | "Pre-compiled `contentHtml` serves reads in <2 ms without runtime PHP calls." | Every save writes `contentHtml = ""` (`article-repository.ts:126`). The next read calls MediaWiki `action=parse` (3.5 s timeout), and **every** read calls MediaWiki for authors (`article-store.ts:180`, `http-reader.ts:234-275`, 8 s timeout, uncached). |
| `WIKIOS.md:9`, `wikios-independence-2b-3.md:13` | "PostgreSQL is 100% authoritative for reads, writes, search, and assets." | Rendering, templates, Lua, uploads, image bytes, file search fallback, category autocomplete fallback, author and creator data, and the Main Page all come from MediaWiki. Assets are metadata pointers to `ixwiki.com/images`. |
| `wikios.md:29`, `WIKIOS.md:191`, `(wiki-os)/README.md:120` | "Trigram typo-tolerant" Spotlight, "PostgreSQL GIN index", "<1.5 ms" | Search is a Prisma `contains` (`native-search-service.ts:58`). There is no `pg_trgm` and no GIN index on `wiki_articles` (grep of `prisma/`: only map indexes). |
| `wikios.md:30-33`, CHANGELOG:152-160 | "`@unique md5Hash` … zero duplication" | `md5Hash` is the hash of the filename (`media-asset-service.ts:55`), so it cannot detect duplicate content. |
| `WIKIOS.md:20`, `core/parser-functions.ts:1-6` | A native ParserFunctions evaluator "replaces MediaWiki's PHP extension." | Only a test uses it. |
| `WIKIOS.md:160` | "Rollback: revert … in a single transaction." | It is two steps: read history, then `saveArticle`, with no purge (WK-16). Accurate enough, but "single transaction" oversells it. |
| `wikios.md:52-53` | "Turnstile verifies human edits … when the client sends a token." | The result is ignored and no client sends one (WK-4). |
| CHANGELOG:385-388 | "`@wikios/core` package with 7 primitives." | There is no `@wikios/core` alias in `tsconfig`/`package.json`, and no source imports it. It is the in-repo `~/lib/wiki-os`. |
| CHANGELOG:406 | Export worker runs "under the dedicated bot account (`WikiOS-Bridge`)." | The default bot is `Heku@WikiOS` (`src/env.ts:92`), a bot password on a personal account (NEW-1). |
| `lib/wiki-os/auth.ts:7` | "See plans/wikios-workstream-c-packaging.md." | That file does not exist (the longevity doc admits this at line 11). |
| `sync-worker.ts:5` | "Automatically attributes revision actors in MariaDB." | No-op, and MariaDB has been removed. |
| `sync-worker.ts:66` comment | "Record `mwLatestRevId` … to prevent inbound echo loops." | The inbound sync never reads `mwLatestRevId`, so the echo still happens (NEW-4). |
| `migrate-mediawiki.ts:1-12` | Imports from a live DB, SQL dumps, or "XML export dumps (`--xml`)." | `--xml` is never parsed (grep: only line 7). The script imports `bridge/mysql-pool`, which was deleted on 2026-08-25, and it is archived. |
| `docs/systems/stash.md:1` | Stash's "Parent App Suite" is WikiOS. | Five apps write Stash rows (§6). The `StashItem.contentType` comment in `wiki.prisma:288` lists `wiki\|forum_thread\|forum_post`. Onoma also writes `name` and `dictionary`, and media uses `commons:` title prefixes. |
| `stash.md` §2.3 | "Share link" | Acknowledged there: `?stash=` is never read, and there is no visibility field. |
| `onoma-voice-guide.md:14-30` | Diagram: "Kokoro enabled?" → synthesize. | The real first gate is sign-in plus owner, admin or beta role (`tts/route.ts`). Ordinary users only ever get Web Speech. |
| `WIKIOS.md:39` (topology) | "Narrator player" is part of the WikiOS client. | That is the TTS player. The "AI Narrator" in `docs/reference/api-complete.md:61` is admin-only, with no production use. |
| `wikios-longevity-workflow.md:32-33` | The only hard-coded `ixwiki.com` exception is `html-transformer.ts`. | 48 non-comment `ixwiki.com` references remain across 21 WikiOS files, including `write-service.ts`, `csrf-cache.ts`, `parsoid.ts`, `pg-reader.ts`, `image-url.ts`, and the layout canonical (`wiki/layout.tsx:26`). |
| `SYSTEM_STATUS.md:60` | Native lore engine "✅ Live … no MariaDB path." | True, but it omits that uploads are broken and that rendering depends on MediaWiki. |

Undocumented behaviour:

- The layout canonical for every WikiOS page is `https://ixwiki.com/wiki/Main_Page` (`wiki/layout.tsx:26`).
- The article page resets the canonical to the MediaWiki URL **client-side** (`wiki/[slug]/page.tsx:196-203`).
- WikiOS deliberately gives its SEO authority to MediaWiki.
- The Main Page is always MediaWiki's HTML.
- Categories removed from a page are never removed from `wiki_category_members`.

---

## 3. MediaWiki compatibility

### 3.1 Feature-by-feature (what IxWiki relies on)

| MediaWiki capability | WikiOS native? | How it works | Share native |
|---|---|---|---|
| Wikitext storage and revisions | **Native** | `wiki_articles`, `wiki_revisions` | ~100% |
| Parsing: links, headings, lists, basic tables | Native **fallback only** | `transformers/wikitext-parser.ts` (regex) | used only when MediaWiki is down |
| Template transclusion, ParserFunctions, magic words | **Proxied** | `action=parse` (`parsoid.ts:124-163`, `page-content.ts:177-200`) | ~0% (the native evaluator is dead code) |
| Lua / Scribunto modules | **Proxied** | inside `action=parse` | 0% |
| Infoboxes | Proxied render, **native extraction** | `transformers/infobox-parser.ts`, `html-transformer.ts` split the rendered infobox | extraction native, rendering MediaWiki |
| TemplateStyles and ResourceLoader CSS | **Proxied** | rewritten to `https://ixwiki.com/load.php` in the browser (`html-transformer.ts:373-433`) | 0% |
| References (`<ref>`) | Proxied (native fallback is basic) | `wikitext-parser.ts:282-297` | fallback only |
| Uploads | **Broken** | `editing.ts:244-303` (WK-5) | 0% |
| Image hosting and thumbnails | **Proxied** | `/api/mediawiki/ixwiki/[...path]` to `ixwiki.com/images`, `thumb.php` | metadata native, bytes MediaWiki |
| Edit conflicts | **Missing** | WK-2 | 0% |
| Users | IxStates/Clerk users; MediaWiki usernames linked by token proof (`adapters/mediawiki/account-proof.ts`) | not compatible with MediaWiki accounts, groups or rights | — |
| Permissions and groups | **Missing** | admin = system owner only (`auth.ts:85`); no autoconfirmed, sysop, bureaucrat or interface-admin | ~0% |
| Protection | **Stub** | enforced in code, never set (WK-3) | 0% effective |
| Blocks, anonymous or IP editing | **Missing** | sign-in is required to edit | — |
| Move, delete, undelete | **Dead** | WK-7 | 0% |
| Categories | **Native from synced data** | regex over literal tags; template-added categories missed; WikiOS saves don't update them | partial |
| Redirects | **Native** | `pg-reader.ts:197-205` (one hop, regex) | ~90% |
| Search | **Native** | `contains` plus per-query `tsvector` | basic |
| Recent changes, contributions, history, diff, what-links-here, random, orphans, dead ends, broken redirects, longest and shortest pages, statistics | **Native** | `/util/*`, `routers/wikios/utilities.ts`, `pg-activity.ts` (with MediaWiki HTTP fallback at `:72+`) | high |
| Watchlist | Native; **no notifications** | WK-19 | partial |
| Talk pages | Replaced by Margin (Postgres); MediaWiki talk is synced but not shown | — | divergent |
| Special pages (Upload, MovePage, Protect, Block, UserRights, Log, AllPages, PrefixIndex, Export, Import, Preferences) | **Missing**, except for an audit-log viewer (`getAuditLogs`) | — | small |
| `api.php` for bots and tools (Pywikibot, AWB, Lorewards bot) | **Not provided.** `/api/mediawiki/[wiki]/api.php` is a read-only **proxy** to MediaWiki (actions `query\|opensearch\|parse`, `_config.ts:38`). | Bots must keep talking to real MediaWiki | 0% |
| XML dump import and export | **Missing** | no `export-0` or `<mediawiki` handling anywhere in `src/` or `scripts/` | 0% |

A rough weighting of what IxWiki's day-to-day use touches (reading, editing, templates and infoboxes, images, history,
categories, search): about 35–45% is native. That share is mostly storage, history, navigation and special-page
equivalents. **The parts that make IxWiki look and work like IxWiki (templates, Lua, infobox rendering, CSS,
images) are close to 0% native.**

### 3.2 Front-end or replacement?

**It is a front-end.** The decisive evidence is below:

- **The render path reads MediaWiki's copy of the page, not WikiOS's.** `action=parse&page=<title>`
  (`page-content.ts:182`, `parsoid.ts:79`) returns MediaWiki's current revision. It only matches Postgres after the
  export worker has pushed the edit.
- **The canonical URL points at MediaWiki** (`wiki/layout.tsx:26`; `wiki/[slug]/page.tsx:202-203`).
- **Uploads and image bytes live only in MediaWiki.**
- **Author and creator data comes from MediaWiki on every view** (`article-store.ts:180`).
- **Bots and tooling can only use MediaWiki's API.**

The team's own docs choose this deliberately. The end state is "MediaWiki as a locked-down headless
render+template engine behind WikiOS *is* the independence goal", and "Stage 1 and 'full parser independence'
remain rejected" (`wikios-independence-2b-3.md:90-91`).

### 3.3 Path to "seamless transition"

What exists: `scripts/sync-ixwiki-full.ts` (MariaDB → Postgres ETL; needs `mysql2` and direct DB credentials),
`sync-ixwiki-media.ts` (asset metadata), `sync-wikios-categories.ts`, the recent-changes cron, and the archived, broken
`migrate-mediawiki.ts`. Seamless transition for *IxWiki* means dual-running with sync, which is what exists now. For
*another community*, nothing works yet.

Minimum viable migration product, in order:

1. **XML dump importer.** MediaWiki's `export-0.11` format carries pages, revisions, contributors and namespaces. It
   works from any host, needs no database access, and is the format every MediaWiki admin can produce. Add an image
   tarball importer that fills `wiki_assets` *with bytes* (this needs decision D3(b), native storage).
2. **Render service contract.** Formalise "headless MediaWiki" as a pluggable renderer interface that takes wikitext
   and returns HTML (a `wikitextToHtml` equivalent). Render from **Postgres wikitext** (`action=parse&text=`), never
   `&page=`. Ship a docker-compose file with a stock MediaWiki, Scribunto and ParserFunctions as the default renderer.
   This removes the need for MediaWiki to hold content at all.
3. **Pre-render on save and on sync** into `contentHtml`, with `htmlSyncedAt` and the revision id, so reads really
   are served from Postgres.
4. **XML exporter**, so the migration can be reversed. This is the lock-in answer licensees will ask for.
5. **An `api.php` compatibility subset** (`query` for revisions, categorymembers, allpages and recentchanges; `edit`,
   `parse`, `login`) so existing bots keep working.
6. Rights model (groups, protection, blocks), move and delete, and edit conflicts. These are WK-2, WK-3 and WK-7.

---

## 4. Standalone and licensing readiness

### 4.1 Coupling measured

- **`lib/wiki-os` core is relatively clean.** Imports from outside the module are `~/server/db` in 18 files,
  `base-path` (4), `cache` (3) and `lib/auth` (2, for `isSystemOwner`). There is one import each from `maps`,
  `country-geo`, `cards/lore-card-generator` and `builder/wiki-data-extractor`, the last three inside
  `adapters/ixstates` (3.2k lines, which already works as a plugin folder). The only Prisma models used outside
  `Wiki*` are `user`, `systemConfig`, `externalApiCache` and `auth`.
- **Everything around the core is IxStates-specific:**
  - **tRPC and Clerk:** 67 `~/trpc/react` imports; `protectedProcedure` and `ctx` come from Clerk; `(wiki-os)/layout.tsx`
    mounts `WikiHalo` and `MediaContext` from platform components.
  - **UI:** 50 `~/components/ui` and 23 `~/lib/sound` (Cuelume) imports in WikiOS UI and routers.
  - **Schema:** `wiki.prisma` relations point at `User` (6 relations) and `Country` (`BlurbResponse`, discussion `countryId`).
  - **Identity:** the author name falls back to **country name** (`auth.ts:64-66`).
  - **Tenancy:** `WikiSource` is a closed union `"ixwiki" | "iiwiki" | "althistory"` (`config.ts:8`).
  - **Hosts:** 48 hard-coded `ixwiki.com` references remain.
- **Multi-tenancy.** The rows carry a `source` column, which is the beginning of tenancy, but `WikiCategory.slug` is
  globally `@unique` (`wiki.prisma:183`). Two wikis cannot both have `Category:History`. The same applies to
  `WikiAsset.slug` and `md5Hash`, and to `WikiTemplate.name`. There is no tenant in Stash, Margin or the watchlist.
- **Config.** Environment variables and `SystemConfig` rows, with no single WikiOS config object for a licensee to
  fill in.
- **Packaging.** None exists: no workspace package, no Docker image, no separate Prisma schema. Workstream C "has not
  started" (`wikios-longevity-workflow.md:11`).

### 4.2 Blockers ranked (hardest first)

1. **Renderer dependency.** WikiOS cannot render without a MediaWiki that holds the same content. Fix with §3.3 steps
   2 and 3 (renderer contract, render from Postgres wikitext). **Size: M–L.** Nothing else matters until this is done.
2. **Media storage.** There is no native byte store, and uploads are broken. Fix with D3(b): an S3 or R2 driver, a
   thumbnailer, and real content hashing. **Size: M–L.**
3. **Identity and permissions.** Clerk is wired into tRPC `ctx`, the only admin is the system owner, there are no
   groups or protection, and all writes go through one shared MediaWiki bot. Make the `auth.ts` seam real: an
   auth-provider adapter plus a wiki rights model. **Size: L.**
4. **Schema and tenancy.** Split `wiki.prisma` into a standalone schema with a `tenantId`, remove the `User`/`Country`
   foreign keys (use an opaque `actorId`), and scope the globally unique slugs per tenant. **Size: M–L.**
5. **Migration tooling.** XML import and export (§3.3 steps 1 and 4). **Size: M.**
6. **App-shell coupling.** Halo, Facet UI, Cuelume sound, tRPC client and `base-path`. Extract a `@wikios/ui`
   package, or host WikiOS as a hostname-mode app like `maps.ixwiki.com`. **Size: M.**
7. **Configuration and branding.** Remove the 48 `ixwiki.com` literals, the SEO canonical and the `IxWiki` titles in
   `wiki/layout.tsx`. **Size: S–M.**
8. **Correctness debt a licensee would hit on day one.** NEW-1 to NEW-6, WK-2, WK-3, WK-5 and WK-7. **Size: M total.**

Unique angle worth keeping: the `registerTemplateProvider` seam for live data embeds
(`MyCountry:`/`CountryData:`/`BusinessData:`), the Plate editor with lossless template blocks, Margin, and
Postgres-speed navigation. These are real differentiators over MediaWiki, once blockers 1–3 are fixed.

---

## 5. Onoma and Narrator

### 5.1 What is real

The Onoma engine runs in the browser and has almost no dependencies: `lib/onoma` imports only `base-path` and
`worldgen/rng` from outside itself. It covers:

- Markov naming with backoff
- a culture classifier
- grapheme-to-IPA conversion for 12 or more cultures
- declensions and script transliteration
- sound-shift simulation
- perplexity scoring
- a phoneme comparator
- a Kokoro phoneme bridge

Persistence (etymology, syntax, writing systems, loanwords, packs, history) is real CRUD. Voice is real, but
access-gated.

### 5.2 Promising, and what external products it could be

- **Onoma SDK (npm) plus a hosted API.** Deterministic, offline name and conlang generation for game studios, TTRPG
  tools and worldbuilders. `lib/onoma` is close to liftable: swap the two imports and ship the committed JSON
  lexicons. This is the lowest-effort external product in the repo.
- **Onoma Studio (web app).** The labs UI (23k lines) depends on Facet `components/ui` (54 imports), tRPC (19) and
  Stash via `useNameBank`. It needs the same shell extraction as WikiOS.
- **Pronunciation and voice API.** IPA to Kokoro phonemes to audio (`kokoro-phonemes.ts`, `/api/onoma/tts`). This is
  a niche product: a "say this invented word correctly" API.
- **Gaps before selling it:** there is no pack publish path (SL-18), no LLM phases (6 and 10), and the marketplace
  has no moderation or licensing of user packs.

### 5.3 What "getting Narrator right" requires (per the code)

1. **A production caller.** Nothing outside the admin playground calls `queryLLM` today. Rebuild a narrow,
   cached, server-side path, e.g. flavour text generated once per issue or decision and stored on the record, instead
   of a per-view `getFlavorText`. ROADMAP D10 recommends "retire until M4 needs it".
2. **One LLM client.** Merge `lib/narrator/client.ts` and `lib/sports/commentary/narrator.ts`, keeping the sports
   copy's SSRF guard. Stop the silent fallback to `sports:llm:*` keys (`client.ts:33-60`).
3. **Secret storage.** Keys are stored as plaintext `SystemConfig` values. Masking on read is fixed (`378b224f8`);
   encryption at rest is not done.
4. **Grounding on wiki canon.** `canon-context.ts` passes only a `canonSource` pointer and never reads the article.
   Real grounding means including the infobox and summary from `WikiArticle`, plus an evaluation set checking the
   "reference ONLY canon facts" rule.
5. **Cost and abuse control.** Per-user and per-country quotas, and writing to the `flavor:` cache that the stats
   panel already reads.
6. **Wiki Narrator (TTS).** Decide whether read-aloud is a feature for everyone. If it is, Kokoro capacity is the
   constraint, and the role gate in `tts/route.ts` must become a quota. Document the gate either way.
7. **Naming.** Rename the pieces to separate TTS read-aloud (Onoma Voice) from LLM narration (Narrator), and fix
   `api-complete.md` and `WIKIOS.md:39`.

---

## 6. Taxonomy: where Stash, the repository, canvas and Margin belong

Stash's consumers, from the code:

- **WikiOS:** `routers/wikios/stash.ts`, `watchlist-annotations.ts`, the reader, editor and margin components, and
  the `/stashes` hub.
- **Forum:** `routers/forum/stash.ts`, with `contentType: "forum_thread"`.
- **Onoma:** `routers/onoma/namebank.ts`, with `contentType: "name" | "dictionary"` (13 Stash calls).
- **Lore Cards:** `routers/lore-cards/wiki.ts:226-271`, which uses Stash as an import source.
- **Messages:** `components/messages/MessagesStashAttachmentModal.tsx`.
- **Dashboard and Halo:** they link into it.
- **Admin:** `routers/admin/stash.ts`.

Six writer or reader routers across five apps.

The shared image picker is `components/wiki-os/media-search/MediaSearchModal.tsx`. It has tabs for the wiki
repository (`commons.*` and `wikios.searchFiles`), My Stash and Upload (to the **platform** `/api/upload/image`).
Its callers are thinktanks, MyCountry (card images, department icons), sports (league and team settings, league
creator) and thinkpages (post composers, account creation, glass-canvas composer). That is 10 non-wiki surfaces. The
WikiOS editor uses a different modal, `ImageSearchModal`, the one with the broken upload.

Collision bug caused by the current design (NEW-10): `StashItem` is unique on `(stashId, pageTitle)`
(`wiki.prisma:298`). An Onoma name "Rome" and the wiki article "Rome" in the same default stash overwrite each other
(`onoma/namebank.ts:332-345` upserts on `stashId_pageTitle`).

**Recommendation:**

- **Stash → a core platform service** (like Notifications).
  - **Placement:** its own Prisma file (`stash.prisma`) and its own router (`api.stash.*`).
  - **Items:** `(kind, ref)` with the uniqueness key changed to `(stashId, kind, ref)`, and typed payloads instead of
    JSON in `note`.
  - **Adapters:** apps register item kinds (wiki page, quote, image, forum thread, Onoma name).
  - **UI:** Facet ships the UI parts: `StashButton`, `StashDropdown`, `CreateStashPopover`. **It does not belong in
    Facet core.** Facet is a design system with no data layer, and putting a data service there would couple the
    design system to Prisma and tRPC.
- **Media repository → a core platform service too.** It includes asset storage, `wiki_assets` (renamed to
  `media_assets`), the Commons search, the upload route and `MediaSearchModal`. More non-wiki apps than wiki pages
  already use the picker, and a standalone WikiOS needs a pluggable media store anyway (blocker 2). WikiOS then
  consumes it as "File:" namespace semantics on top.
- **Canvas (Plate) editor → stays in WikiOS**, as `@wikios/editor`. It is tied to the wikitext AST. It could become a
  platform editor later if ThinkPages or Docs want wikitext-free blocks, but nothing uses it outside the wiki today.
- **Margin → stays in WikiOS.** Anchors are wiki sections, `WikiDiscussionThread` is keyed by article. Its Stash tab
  should consume the platform Stash service.
- **Licensing corollary:** a standalone WikiOS would bundle *lite* Stash and media services, or depend on the
  platform ones through an adapter interface. That is another reason to define them as services with interfaces now.

---

## 7. New findings (not in `code-audit-2026-09-30.md`)

| ID | Type | Finding | Evidence | Size |
|---|---|---|---|---|
| NEW-1 ★ | SEC | **All WikiOS writes reach MediaWiki as one bot-password account, `Heku@WikiOS` by default.** Any signed-in IxStates user can save any title, since `title` is any 1–500 character string and new pages pass the protection check (`auth.ts:108`). The export worker then pushes the edit with that account's rights. That bypasses MediaWiki page protection, and may allow edits in the `Template:`, `Module:` and `MediaWiki:` namespaces (e.g. `MediaWiki:Common.js` means site-wide JavaScript on ixwiki.com), **if** the grants on Special:BotPasswords include protected-page or interface editing. The same identity also takes the blame on MediaWiki for every user's edits. **Verify the bot-password grants now; restrict saveable namespaces server-side.** | `src/env.ts:92`; `csrf-cache.ts:126-134`; `sync-worker.ts:54-64`; `editing.ts:81-130` | S to mitigate |
| NEW-2 | BUG | **Edits made on MediaWiki never refresh the reader.** The inbound sync updates `wikitext` but not `contentHtml`, and the reader prefers non-empty `contentHtml`. | `auto-sync-service.ts:216-247`; `page-content.ts:163-200` | S |
| NEW-3 | BUG | **A WikiOS save can make the pre-edit HTML permanent.** The save writes `contentHtml=""` and queues the export. The client refetches right away (`wiki/[slug]/page.tsx:219-221`), and the server renders MediaWiki's **current (old)** page with `action=parse&page=`, then saves that HTML (`saveArticleHtmlShadow`). The stale HTML stays until the next save. With `SKIP_MEDIAWIKI_SYNC=true`, WikiOS edits never render at all. Code path confirmed; not reproduced at runtime. | `article-repository.ts:126`; `page-content.ts:177-200`; `parsoid.ts:79-94` | S (render `&text=` from Postgres wikitext) |
| NEW-4 | BUG | **Echo: each WikiOS edit becomes a second revision credited to the bot.** The export worker records `mwLatestRevId` on the article, but the sync checks only `wikiRevision.mwRevId`, which WikiOS revisions never set. Sequential quick edits can also briefly roll Postgres wikitext back to the older exported version. | `sync-worker.ts:66-83`; `auto-sync-service.ts:420-432` | S |
| NEW-5 | PERF | **Every article view makes a blocking MediaWiki HTTP call** (`prop=revisions`, `rvlimit=250`, 8 s timeout, uncached) for creator and last editor. For WikiOS-created pages the creator is the bot. | `article-store.ts:170-230`; `http-reader.ts:234-275`; `page-content.ts:231,253` | S |
| NEW-6 | BUG | **Categories drift.** WikiOS saves never update category membership. The inbound sync only adds, never removes. Categories that templates add are never captured. | `link-graph-service.ts:34`; `auto-sync-service.ts:280-312` | M |
| NEW-7 | SEO | The server-rendered canonical for every `/wiki/*` page is `ixwiki.com/wiki/Main_Page`, and the article is client-rendered with the canonical fixed in `useEffect`. Crawlers that don't run JavaScript see every article canonicalised to MediaWiki's Main Page. | `wiki/layout.tsx:26`; `wiki/[slug]/page.tsx:1,190-204` | S |
| NEW-8 ★ | SEC | **A real-looking default MariaDB password is committed** as the `IXWIKI_DB_PASSWORD` fallback. The value is not repeated here. Rotate it if it was ever real, and remove the fallback. | `scripts/sync-ixwiki-full.ts:35`; `scripts/audit/audit-wikios-parity.ts:31` | S |
| NEW-9 | DEAD/DOC | `migrate-mediawiki.ts` is archived and cannot run: it imports the deleted `mysql-pool`, and `--xml` is advertised but not implemented. There are two different `audit-wikios-parity.ts` copies (`scripts/` and `scripts/audit/`). | `scripts/archive/migrations/wiki/migrate-mediawiki.ts:7,17-20` | S |
| NEW-10 | BUG | **Stash key collision across content types.** `(stashId, pageTitle)` is unique, so an Onoma name and a wiki page with the same title overwrite each other. | `wiki.prisma:298`; `onoma/namebank.ts:332-345` | S–M |
| NEW-11 | PERF | The media proxy keeps up to 500 full image buffers in process memory (possibly hundreds of MB per Node process). | `app/api/mediawiki/ixwiki/[...path]/route.ts:13-16` | S |
| NEW-12 | PERF/DOC | Search has no trigram or GIN index, computes `to_tsvector` per row per query, and reads only the first 3,000 characters. | `native-search-service.ts:58,129-145` | S (add a generated column plus a GIN index) |
| NEW-13 | ABUSE | `previewWikitext` is public (rate-limited) and forwards up to 200k characters to MediaWiki `action=parse`, making it an anonymous render proxy onto the PHP parser. | `editing.ts:59-79` | S (make it protected) |
| NEW-14 | SEC-lite | The Narrator LLM client has no SSRF guard on the admin-set `apiUrl` (the sports copy has one), and it silently reuses the sports LLM keys. | `lib/narrator/client.ts:17-80,83-130` | S |

WK items rechecked on this commit: **WK-2, WK-3, WK-4, WK-5, WK-7, WK-16 and WK-19 are still open as described.**
WK-12 (key masking) is fixed in `routers/narrator/index.ts:27-37`.

---

## 8. Suggested order

1. **Now (S):**
   - NEW-1: check the bot grants and allowlist namespaces for saves.
   - NEW-8: rotate and remove the committed password.
   - NEW-3: render from Postgres wikitext with `&text=`.
   - NEW-2 and NEW-4: null `contentHtml` on sync, and set `mwRevId` on the exported revision.
   - NEW-5: cache author data or read it from `wiki_revisions`.
   - WK-2: edit conflicts.
2. **Next (M):**
   - Uploads with native media storage (D3(b)).
   - Protection and a rights model (WK-3).
   - Move and archive (WK-7).
   - Category sync on save (NEW-6).
   - Stash as a platform service with typed kinds (NEW-10).
3. **Product track (L):**
   - Renderer contract.
   - XML import and export.
   - Tenancy in the schema.
   - Auth adapter.
   - Hostname-mode standalone deployment.
   - Workstream C packaging.
   - Onoma SDK extraction in parallel (smallest effort).
