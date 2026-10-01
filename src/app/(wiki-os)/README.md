# WikiOS

**Last updated:** September 29, 2026  
**Architecture Status:** Decoupled Native Knowledge Engine (Plan 170 Complete)

WikiOS is an ultra-fast, structured knowledge engine and worldbuilding platform. PostgreSQL is the authoritative primary backend for article content, append-only revisions, directed link graphs, and category hierarchies, delivering **sub-2ms reads** and **sub-10ms atomic writes**. Upstream MediaWiki is integrated as a headless render (`action=parse`), asynchronous export, and recent-changes sync adapter over its HTTP Action API (`adapters/mediawiki/`, `services/auto-sync-service.ts`); there is no direct MariaDB connection.

The editor stack provides a Plate-based visual editor (WikiAST ↔ wikitext), a **CodeMirror 6** source editor, and a zero-navigation in-place editing bridge (`WikiEditBridge`). Reader rendering is accelerated by server-side pre-compiled HTML, browser-native `content-visibility: auto`, and edge CDN cache tagging.

---

## 1. Routes (`(wiki-os)` group → `/wiki/*` and `/util/*`)

Utility pages live under `/util/*`. Every `/wiki/<path>` URL is served by one catch-all route, `wiki/[...slug]`, which is also where the old `/wiki/<tool>` URLs land: a lower-case tool slug (`/wiki/recent-changes`, `/wiki/categories/Countries`, `/wiki/history/Foo`, ...) redirects to its `/util/*` route unless a page with exactly that title exists, so no title is hijacked by a tool.

The route (plan 412) is a server component: `resolveWikiPath` (`src/lib/wiki-os/wiki-path.ts`) parses the URL, the article is read on the server and primed into the query cache (`HydrateClient`), so the first HTML holds the article; a page that does not exist is a 404 (`not-found.tsx`), a redirect page is a 308 to its target with `?rdfrom=`, a non-canonical spelling is a 308 to the canonical one. `generateMetadata` gives the article its own title, description, canonical URL (WikiOS is the canonical host) and link card.

| Route | File | Purpose |
|-------|------|---------|
| `/wiki` | `wiki/page.tsx` | WikiOS main page (`WikiOSMainPage`) |
| `/wiki/<title>` (any depth: `/wiki/A/B`) | `wiki/[...slug]/page.tsx` | Article reader + in-place editor bridge. `?action=edit` opens the editor (`&section=new` is "Add topic"), `?action=history` / `?action=info` / `?oldid=` / `?diff=` show those views in place, `?redirect=no` shows a redirect page, `?action=raw` is answered by `/api/wiki/raw`, `?margin=threads` opens Margin, `?source=iiwiki\|althistory` reads another wiki's page read-only |
| `/wiki/Talk:<title>` and every `<ns> talk:` page | same | Ordinary wikitext pages; the reader's Page / Discussion tabs link the pair. `/wiki/<title>/talk` redirects here, `/wiki/<title>/edit` to `?action=edit` (unless a page with that name exists) |
| `/wiki/User:<name>`, `/wiki/Category:<name>`, `/wiki/File:<name>` | same | The page's wikitext, plus a profile card / the members of the category (200 to a page, `?from=`) / the file |
| `/wiki/Special:<Name>[/<arg>]` | same | `Special:RecentChanges`, `Watchlist`, `Categories`, `Search`, `Diff/<a>/<b>`, `Contributions/<user>`, `WhatLinksHere/<title>`, `Export`, `Import` and the rights-model pages (`Log[/type]`, `Move`/`MovePage`, `Delete`, `Undelete`, `Protect` with a title, `Block`, `UserRights` with a user, `BlockList`) redirect to the matching `/util/*` tool (`?action=delete|protect|unprotect` on a page go to the same screens); `Random` and `FilePath/<file>` redirect to a page / the file; `AllPages` and `PrefixIndex/<prefix>` list pages in place; any other special page is a 404 |
| `/wiki-sitemap`, `/wiki-sitemap/<n>`, `/robots.txt` | `src/app/wiki-sitemap/**`, `src/app/robots.txt/route.ts` | Sitemap index and files (50,000 published main-namespace pages each), robots.txt |
| `/api/wiki/raw` | `src/app/api/wiki/raw/route.ts` | `text/x-wiki` wikitext of a page or revision; `src/proxy.ts` rewrites `/wiki/<title>?action=raw` here |
| `/util` | `util/page.tsx` | Special directory & utilities deck (`/wiki/utilities` and `Special:SpecialPages` redirect here) |
| `/util/search` | `util/search/page.tsx` | Prefix & full-text search |
| `/util/recent-changes` | `util/recent-changes/page.tsx` | Global append-only edit ledger feed |
| `/util/history/[slug]` | `util/history/[slug]/page.tsx` | Revision history (scrubbable timeline) |
| `/util/diff` | `util/diff/page.tsx` | Side-by-side visual revision diff viewer |
| `/util/random` | `util/random/page.tsx` | Random article redirect |
| `/util/categories`, `/util/categories/[...slug]` | `util/categories/…` | Category index and recursive category browser |
| `/util/whatlinkshere/[slug]` | `util/whatlinkshere/[slug]/page.tsx` | Relational backlinks explorer |
| `/util/contributions/[user]` | `util/contributions/[user]/page.tsx` | User contribution history |
| `/util/lorewards` | `util/lorewards/page.tsx` | Lorewards leaderboard & heatmap streak calendar |
| `/util/repository` | `util/repository/page.tsx` | Native media commons asset repository (`wiki_assets`) |
| `/util/templates` | `util/templates/page.tsx` | Template browser |
| `/util/watchlist` | `util/watchlist/page.tsx` | Article watchlist (`WikiWatchlist` model) |

---

## 2. Key Features

| Area | Feature |
|------|---------|
| **Instant Native Engine** | **Sub-2ms reads** from PostgreSQL pre-compiled `contentHtml`, **$O(1)$ backlinks** via `wiki_links`, **zero-query red links** (`targetArticleId = NULL`), and **sub-10ms atomic writes** |
| **Speculative Navigation** | Instant link hover/touch prefetching (`useWikiPrefetch`), localStorage client cache (`editor/local-cache.ts`, 24h TTL), and zero-navigation in-place editor bridge (`WikiEditBridge`) |
| **DOM Acceleration** | Sub-16ms initial paint via CSS `content-visibility: auto` and section containment |
| **Two-Tier Native Search** | Tier 1 typo-tolerant prefix search (<1.5ms) + Tier 2 weighted `tsvector` full-text search with headline snippets |
| **Cloudflare Defense** | Automated edge CDN cache purging on save (editing itself needs a signed-in account and is rate-limited and rights-checked) |
| **Reader** | Pre-rendered HTML transforms, 3D tilt hero banner (`ArticleHeader`), sticky TOC, link hover previews (`LinkPreview`), image lightbox, category breadcrumbs, dynamic map embeds |
| **Editor** | Dual-mode Plate visual editor (WikiAST roundtrip) & CodeMirror 6 source editor with live preview, modular template dialogs, image search/upload modal, and instant 1-click rollback |
| **Stash** | Color-coded collections, one-click stash toggle, text-selection annotations, per-item notes |
| **Lorewards & Streaks** | Prose-quality scoring (`src/lib/lorewards/scoring.ts`), daily/weekly/monthly awards synced from the Discord Lorewards bot's state file, SVG streak heatmap calendar, and article awards (`WikiArticleAward`) |

---

## 3. Architecture & Scaffolding Map

```
src/lib/wiki-os/
├── index.ts                   # Root unified barrel export
├── config.ts                  # Configuration, WikiSource definitions & endpoints
├── types.ts                   # Nominal contracts & base types
├── auth.ts                    # User identity & role abstraction seam
├── page-ref.ts                # Page reference (title + wiki source)
│
├── core/                      # Authoritative PostgreSQL Domain Services
│   ├── domain-types.ts        # Nominal types
│   ├── wiki-ast.ts            # IxWiki AST block model (+ wiki-ast-guards.ts)
│   ├── media-asset-service.ts # wiki_assets registry (+ blurhash-service.ts)
│   ├── article-repository.ts  # Authoritative CRUD repository (<2ms read, <10ms write)
│   ├── link-graph-service.ts  # Link extractor & O(1) relational backlink graph engine
│   ├── native-search-service.ts # Two-tier Spotlight autocomplete (<1.5ms) & full-text search
│   └── category-service.ts    # Recursive category tree DAG & member lookups
│
├── guardian/                  # Security & Edge Defense
│   └── cloudflare-guardian.ts # global CDN cache purges on save
│
├── adapters/                  # External Service Adapters & Background Workers
│   └── mediawiki/             # Legacy MediaWiki compatibility & federation suite
│       ├── parsoid.ts         # Parsoid & Action API HTML <-> wikitext converter
│       ├── write-service.ts   # The mirror bot's Action API calls (typed errors, XML import upload)
│       ├── csrf-cache.ts      # The mirror bot's login + CSRF token (no anonymous fallback)
│       ├── timestamp.ts       # 14-digit timestamp conversion
│       └── bridge/            # PostgreSQL readers (pg-*.ts) & external wiki HTTP federators
│
├── transformers/              # Content Transformers, Parsers & Formatters
│   ├── html-transformer.ts    # Server-side HTML post-processor (Infobox, TOC, Notices)
│   ├── infobox-parser.ts      # Zero-dependency wikitext infobox & template tokenizer
│   ├── wikitext-diff.ts       # Visual wikitext LCS diff calculator
│   ├── image-url.ts           # Client-safe image URL & thumbnail resolver
│   ├── url-compat.ts          # Canonical wiki route rewriting
│   ├── fix-editor-images.ts   # Image sanitizer for editor visual canvas
│   ├── safe-decode.ts         # Resilient URI decoder utility
│   ├── media-theme.ts         # Theme-aware media switcher (Auto/Plinth/Dark)
│   └── resolve-highres-image.ts # Vector SVG and high-res thumbnail un-scaler
│
├── templates/                 # Template Engine & Registry
│   ├── template-resolver.ts   # Pluggable wikitext template provider registry
│   ├── template-registry.ts   # Client-side TemplateData registry & parameter schemas
│   ├── master-presets.ts      # Template presets for the slash menu
│   └── preview-service.ts     # Tiered template preview cache (+ .server.ts)
│
├── editor/                    # Editor State & Embeds
│   ├── draft-store.ts         # LocalStorage visual & source draft persistence
│   ├── local-cache.ts         # LocalStorage wiki data cache
│   └── wiki-embed-shared.ts   # Shared CSS/JS bundle definitions for interactive embeds
│
├── wikitext/                  # Wikitext parser & serializer
└── services/
    └── auto-sync-service.ts   # MediaWiki recentchanges → PostgreSQL sync (cron + webhook)
```

---

## 4. Performance Latency Benchmarks

| Operation | Target Latency | Implementation Mechanism |
| :--- | :--- | :--- |
| **Article Read** | `< 2 ms` | Pre-compiled `contentHtml` query from PostgreSQL indexed by `(source, title)` |
| **Spotlight Autocomplete** | `< 1.5 ms` | In-memory prefix matching + PostgreSQL GIN index |
| **Article Write** | `< 10 ms` | Atomic PostgreSQL transaction + non-blocking background sync queue |
| **Backlinks Lookup** | `< 1 ms` | Indexed relational lookup on `wiki_links(targetSlug)` |
| **Category DAG Query** | `< 3 ms` | CTE recursive query traversing hierarchical category tree |
| **DOM First Paint** | `< 16 ms` | CSS `content-visibility: auto` with layout containment |
