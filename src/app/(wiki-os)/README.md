# WikiOS

**Last updated:** August 22, 2026  
**Architecture Status:** Decoupled Native Knowledge Engine (Plan 170 Complete)

WikiOS is an ultra-fast, structured knowledge engine and worldbuilding platform. PostgreSQL is the authoritative primary backend for article content, append-only revisions, directed link graphs, and category hierarchies, delivering **sub-2ms reads** and **sub-10ms atomic writes**. Upstream MediaWiki is integrated purely as an asynchronous compatibility and federation adapter (`adapters/mediawiki/`).

The editor stack provides a custom visual editor (HTML ↔ Structured Block AST), a **CodeMirror 6** source editor, and a zero-navigation in-place editing bridge (`WikiEditBridge`). Reader rendering is accelerated by server-side pre-compiled HTML, browser-native `content-visibility: auto`, and edge CDN cache tagging.

---

## 1. Routes (`(wiki-os)` group → `/wiki/*`)

| Route | File | Purpose |
|-------|------|---------|
| `/wiki` | `wiki/page.tsx` | Redirects to `Main_Page` |
| `/wiki/[slug]` | `wiki/[slug]/page.tsx` | Article reader + In-place Instant Editor Bridge |
| `/wiki/[slug]/edit` | `wiki/[slug]/edit/page.tsx` | Dedicated editor page (visual + source fallback) |
| `/wiki/[slug]/talk` | `wiki/[slug]/talk/page.tsx` | Talk / discussion page (Margin split-canvas) |
| `/wiki/search` | `wiki/search/page.tsx` | Sub-1.5ms Spotlight prefix & full-text search |
| `/wiki/recent-changes` | `wiki/recent-changes/page.tsx` | Global append-only edit ledger feed |
| `/wiki/history/[slug]` | `wiki/history/[slug]/page.tsx` | Revision history & byte-diff lineage |
| `/wiki/diff` | `wiki/diff/page.tsx` | Side-by-side visual revision diff viewer |
| `/wiki/random` | `wiki/random/page.tsx` | Random article redirect |
| `/wiki/categories/[...slug]` | `wiki/categories/[...slug]/page.tsx` | Recursive CTE category DAG browser |
| `/wiki/whatlinkshere/[slug]` | `wiki/whatlinkshere/[slug]/page.tsx` | $O(1)$ relational backlinks graph explorer |
| `/wiki/contributions/[user]` | `wiki/contributions/[user]/page.tsx` | User contribution history |
| `/wiki/user/[username]` | `wiki/user/[username]/page.tsx` | User profile, streaks & Loreward award showcase |
| `/wiki/lorewards` | `wiki/lorewards/page.tsx` | Gamified Lorewards leaderboard & heatmap streak calendar |
| `/wiki/repository` | `wiki/repository/page.tsx` | Native media commons asset repository with Blurhash |
| `/wiki/watchlist` | `wiki/watchlist/page.tsx` | Article watchlist (backed by Stash) |

---

## 2. Key Features

| Area | Feature |
|------|---------|
| **Instant Native Engine** | **Sub-2ms reads** from PostgreSQL pre-compiled `contentHtml`, **$O(1)$ backlinks** via `wiki_links`, **zero-query red links** (`targetArticleId = NULL`), and **sub-10ms atomic writes** |
| **Speculative Navigation** | Instant link hover/touch prefetching (`useWikiPrefetch`), multi-tier IndexedDB client cache, and zero-navigation in-place editor bridge (`WikiEditBridge`) |
| **DOM Acceleration** | Sub-16ms initial paint via CSS `content-visibility: auto` and section containment |
| **Two-Tier Native Search** | Tier 1 typo-tolerant prefix search (<1.5ms) + Tier 2 weighted `tsvector` full-text search with headline snippets |
| **Cloudflare Defense** | Invisible Cloudflare Turnstile CAPTCHA verification, Zero-Trust Access service tokens, and automated edge CDN cache purging on save |
| **Reader** | Pre-rendered HTML transforms, 3D tilt hero banner (`ArticleHeader`), sticky TOC, link hover previews (`LinkPreview`), image lightbox, category breadcrumbs, dynamic map embeds |
| **Editor** | Dual-mode visual editor (Block AST roundtrip) & CodeMirror 6 source editor with live preview, modular template dialogs, image search/upload modal, and instant 1-click rollback |
| **Stash** | Color-coded collections, one-click stash toggle, text-selection annotations, per-item notes |
| **Lorewards & Streaks** | Algorithmic prose quality scoring, daily/weekly/monthly awards, SVG streak heatmap calendar, article milestone badges, and Discord webhook broadcasting |

---

## 3. Architecture & Scaffolding Map

```
src/lib/wiki-os/
├── index.ts                   # Root unified barrel export
├── config.ts                  # Configuration, multi-realm definitions & endpoints
├── types.ts                   # Nominal contracts & base types
├── auth.ts                    # User identity & role abstraction seam
│
├── core/                      # Authoritative PostgreSQL Domain Services
│   ├── domain-types.ts        # Nominal types & Block AST node definitions
│   ├── article-repository.ts  # Authoritative CRUD repository (<2ms read, <10ms write)
│   ├── link-graph-service.ts  # Link extractor & O(1) relational backlink graph engine
│   ├── native-search-service.ts # Two-tier Spotlight autocomplete (<1.5ms) & full-text search
│   ├── parser-functions.ts    # Native JS ParserFunctions evaluator (#if, #switch, #expr)
│   └── category-service.ts    # Recursive category tree DAG & member lookups
│
├── guardian/                  # Security & Edge Defense
│   └── cloudflare-guardian.ts # Cloudflare Turnstile verification & global CDN cache purges
│
├── adapters/                  # External Service Adapters & Background Workers
│   └── mediawiki/             # Legacy MediaWiki compatibility & federation suite
│       ├── parsoid.ts         # Parsoid & Action API HTML <-> wikitext converter
│       ├── write-service.ts   # Action API write gateway & CSRF token caching
│       ├── timestamp.ts       # 14-digit timestamp conversion
│       ├── sync-worker.ts     # Non-blocking MediaWiki export mirror queue
│       └── bridge/            # Direct MariaDB connector & external wiki federators
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
│   └── template-registry.ts   # Client-side TemplateData registry & parameter schemas
│
├── editor/                    # Editor State & Embeds
│   ├── draft-store.ts         # LocalStorage visual & source draft persistence
│   └── wiki-embed-shared.ts   # Shared CSS/JS bundle definitions for interactive embeds
│
└── migration/                 # Ingestion & Migration Engine
    └── index.ts               # Streaming SQL/XML dump ingestion pipeline
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
