# WikiOS

**Last updated:** August 18, 2026  
**Architecture Status:** Production-Ready, Instant, and Structurally Decoupled

WikiOS is a modern, React-based wiki frontend that replaces the MediaWiki UI for IxWiki. MediaWiki continues to run headlessly as the backend — it stores content, processes Lua/Scribunto templates, and exposes the Action API and Parsoid REST API. WikiOS replaces everything the reader and editor see and touch, served from the `(wiki-os)` Next.js route group at `/wiki/*`.

The editor stack provides a custom contentEditable visual editor (HTML ↔ Parsoid ↔ wikitext roundtrip), a **CodeMirror 6** source editor, and a fast in-place zero-navigation editing bridge (`WikiEditBridge`). Article HTML is fetched via Parsoid, cached persistently via IndexedDB, and accelerated using browser-native `content-visibility: auto`.

> Status: **Production-ready & instant.** Reader, dual-mode in-place editor, speculative prefetching, offline-resilient client caching, stash, lorewards, blurbs, and special pages are fully wired to live tRPC and Postgres/MySQL shadow stores.

---

## 1. Routes (`(wiki-os)` group → `/wiki/*`)

| Route | File | Purpose |
|-------|------|---------|
| `/wiki` | `wiki/page.tsx` | Redirects to `Main_Page` |
| `/wiki/[slug]` | `wiki/[slug]/page.tsx` | Article reader + In-place Instant Editor Bridge |
| `/wiki/[slug]/edit` | `wiki/[slug]/edit/page.tsx` | Dedicated editor page (visual + source fallback) |
| `/wiki/[slug]/talk` | `wiki/[slug]/talk/page.tsx` | Talk / discussion page |
| `/wiki/search` | `wiki/search/page.tsx` | Sub-3ms PostgreSQL Full-Text & Trigram search |
| `/wiki/recent-changes` | `wiki/recent-changes/page.tsx` | Global edit feed |
| `/wiki/history/[slug]` | `wiki/history/[slug]/page.tsx` | Revision history |
| `/wiki/diff` | `wiki/diff/page.tsx` | Side-by-side visual revision diff viewer |
| `/wiki/random` | `wiki/random/page.tsx` | Random article redirect |
| `/wiki/categories/[...slug]` | `wiki/categories/[...slug]/page.tsx` | Category hierarchy browser |
| `/wiki/whatlinkshere/[slug]` | `wiki/whatlinkshere/[slug]/page.tsx` | Inbound backlinks explorer |
| `/wiki/contributions/[user]` | `wiki/contributions/[user]/page.tsx` | User contribution history |
| `/wiki/user/[username]` | `wiki/user/[username]/page.tsx` | User profile & award showcase |
| `/wiki/lorewards` | `wiki/lorewards/page.tsx` | Lorewards achievements leaderboard & streaks |
| `/wiki/repository` | `wiki/repository/page.tsx` | Commons image search & category explorer |
| `/wiki/watchlist` | `wiki/watchlist/page.tsx` | Article watchlist (backed by LoreStash) |

Related routes live **outside** this group: `/stashes` (Lore Stash browser), `/blurbs` + `/blurbs/[slug]`, `/admin/blurbs`, `/admin/lorewards`, `/admin/stash`, `/admin/wikios-settings`.

---

## 2. Key Features (Implemented)

| Area | Feature |
|------|---------|
| **Instant Engine** | **Speculative link prefetching** on pointer hover/touch (`useWikiPrefetch`), **multi-tier IndexedDB client cache** (100 articles + local drafts), **zero-navigation in-place editor bridge** (`WikiEditBridge`), and **idle wikitext pre-warmup** (`requestIdleCallback`) |
| **DOM Acceleration** | Sub-16ms initial paint via CSS `content-visibility: auto` and section containment on all top-level article headings and infoboxes |
| **Fast Shadow Search** | Sub-3ms title prefix, trigram fuzzy matching, and body text search with relevance ranking (`search-service.ts`) |
| **Reader** | Server-side HTML transform (infobox extraction, TOC, notices), 3D tilt hero banner (`ArticleHeader`), sticky TOC, link hover previews (`LinkPreview`), image lightbox, category breadcrumbs, dynamic map embeds (`InfoboxWithMap`, `CoordinatesMapEmbed`), custom Main Page |
| **Editor** | Seamless visual editor (contentEditable, data-mw roundtrip) & CodeMirror 6 source editor with live preview, modular template dialogs (`template-modals/`), image search/upload modal, edit summary, revert & rollback |
| **Stash** | Color-coded collections, one-click stash toggle, text-selection annotations, per-item notes |
| **Lorewards** | Daily/weekly/monthly awards, leaderboard, streak calendar, user stats, award-winning-article badges, cross-validation vs Discord bot |
| **Blurbs** | Topic-Tuesday prompts, user responses with linked articles, featured responses, country gallery, admin dashboard |
| **Search** | Full-text search, command-palette search modal, category tree |
| **Templates** | Template search, TemplateData sync, live preview, modularized template dialogs |

---

## 3. Architecture & Component Locations

| Layer | Location | Purpose |
|-------|----------|---------|
| **Route group** | `src/app/(wiki-os)/` | Mounts `WikiOSLayout`, `WikiDIPlugin` (Halo/Dynamic Island), and global `useWikiPrefetch` |
| **Reader components** | `src/components/wiki-os/reader/` | `ArticleRenderer.tsx`, `ArticleHeader.tsx`, `ArticleModals.tsx`, `ArticlePlaceholders.tsx`, `ArticleCategories.tsx`, `ArticleFooter.tsx`, `WikiOSMainPage.tsx`, `StickyToc.tsx`, `InfoboxWithMap.tsx`, `LinkPreview.tsx` |
| **Editor components** | `src/components/wiki-os/editor/` | `WikiEditBridge.tsx`, `WikiVisualEditor.tsx`, `WikiSourceEditor.tsx`, `template-modals/` (`InfoboxCountryModal`, `CountryStatsModal`, `BusinessStatsModal`, `MapCoordsModal`), `TemplateInserter.tsx`, `ImageSearchModal.tsx` |
| **Shell & Nav** | `src/components/wiki-os/shared/` | `WikiOSLayout.tsx`, `WikiOSUnifiedSidebar.tsx`, `WikiContext.tsx`, `useWikiOSShortcuts.ts` |
| **Hooks** | `src/hooks/` | `useWikiPrefetch.ts` (speculative hover/touch prefetcher), `useWikiNarrator.ts` |
| **Engine Core** | `src/lib/wiki-os/` | Pure standalone wiki engine (`@wikios/core`): `config.ts`, `types.ts`, `storage-driver.ts` + `drivers/`, `wikios-cache.ts`, `sync-queue.ts`, `draft-store.ts`, `parsoid-client.ts`, `html-transformer.ts`, `template-registry.ts`, `template-resolver.ts`, `article-store.ts`, `search-service.ts`, `bridge.ts`, `infobox-parser.ts`, `image-url.ts`, `auth.ts`, `use-wiki-auth.ts`, `storage.ts`, `wikitext-diff.ts`, `csrf-cache.ts`, `fix-editor-images.ts` |
| **Shared Server** | `src/server/shared/` | `wiki-placeholders.ts` (cross-router dynamic stat resolver), `ixstats-template-provider.ts` (host-app template provider) |
| **Ops & Cutover** | `scripts/ops/` | `stage3-nginx-cutover.conf` (Nginx lockdown), `verify-stage3-cutover.ts` (verification audit) |
| **Styles** | `src/styles/wiki-os.css` | Design system entry + variables, `content-visibility`, elements, components, lorewards, animations |

**Parsoid & API Bridge:** `lib/wiki-os/parsoid-client.ts` fetches rendered HTML from the MediaWiki Parsoid REST API (localhost loopback, cached). `html-transformer.ts` post-processes it (infobox/TOC/notice extraction). All wiki network requests strictly send `DEFAULT_USER_AGENT = "IxStats-Builder"` via `src/lib/wiki-os/config.ts`.

---

## 4. Multi-Tier Resilient Storage Waterfall

WikiOS uses a 4-tier storage hierarchy to ensure 100% availability even during MediaWiki maintenance:

```
[Tier 1: Fresh PostgreSQL Shadow] (<5ms)
       │ (Cache Miss)
       ▼
[Tier 2: Direct MariaDB MySQL] (~38ms)
       │ (MySQL Offline / Cold Page)
       ▼
[Tier 3: MediaWiki Action API HTTP] (~400ms)
       │ (Network Down / 502 Bad Gateway)
       ▼
[Tier 4: Stale Shadow Fallback] (stale: true, <5ms)
```

1. **Local Postgres Shadow (`prisma/schema/wiki.prisma`)**: Holds `wiki_articles` (shadow wikitext and pre-rendered transformed HTML) and `wiki_revisions` (append-only revision history).
2. **Background Warmth Cron (`src/server/cron/sync-wiki-recentchanges.ts`)**: Runs every 2–5 minutes, polling MediaWiki `recentchanges` to keep the local PostgreSQL shadow store 100% warm.
3. **Dual-Write on Save (`recordArticleRevision`)**: Every user edit writes through to MediaWiki and immediately updates `WikiArticle` and `WikiRevision` locally.

---

## 5. Packaging & Portability Seams (Graduation to `@wikios/core`)

WikiOS is structurally decoupled from IxStates so it can be packaged independently for any worldbuilding community:

| Seam | File(s) | Swap Point |
|------|---------|------------|
| **Auth (identity + admin)** | `lib/wiki-os/auth.ts`, `lib/wiki-os/use-wiki-auth.ts` | Map your auth provider here. **Zero `@clerk` imports remain in WikiOS code** outside `use-wiki-auth.ts`. |
| **Storage / identity** | `lib/wiki-os/storage.ts` | User↔Country lookups live only here. |
| **Pluggable Storage Drivers** | `lib/wiki-os/storage-driver.ts`, `lib/wiki-os/drivers/` | Switch between `PostgresStorageDriver`, `SqliteStorageDriver`, or `MemoryStorageDriver`. |
| **Template Data Providers** | `lib/wiki-os/template-resolver.ts` | Pluggable template resolvers. Host database models (`Country`, `PointOfInterest`) are isolated in `server/shared/ixstats-template-provider.ts`. |
| **Runtime Config & Loopback** | `lib/wiki-os/config.ts` | Configures endpoints and loopback overrides (`WIKIOS_MEDIAWIKI_INTERNAL_URL`). |

---

## 6. Data Sources (Unified tRPC Router)

| Router | File Location | Scope |
|--------|---------------|-------|
| `api.wikios.*` | `src/server/api/routers/wikios/` (split: editing, page-content, search-categories, stash, templates, user-talk, watchlist-annotations) | Master WikiOS API (reader, editor, stash, talk, templates, categories, annotations, media search, fast shadow search, recent changes sync) (~65 procedures) |
| `api.lorewards.*` | `src/server/api/routers/lorewards/` | Awards, leaderboard, streaks, user stats, cross-validation |
| `api.blurbs.*` | `src/server/api/routers/blurbs/` | Topic-Tuesday prompts & responses |
| `api.wikiCache.*`, `api.wikiImporter.*` | `src/server/api/routers/wikiCache`, `src/server/api/routers/wikiImporter` | Cache + import support |

---

## 7. Architectural Boundaries

1. **Core Engine (`src/lib/wiki-os/`)**: Standalone engine (`@wikios/core`). Zero IxStates game model imports (`Country`, `Card`, `PointOfInterest`). See [`src/lib/wiki-os/README.md`](../../lib/wiki-os/README.md).
2. **IxStates Game Adapters (`src/lib/wiki/`)**: Host application adapters (Lore Card Studio in `src/lib/cards/`, National Factbooks, Map Pin Mappers) that consume WikiOS through its public APIs. See [`src/lib/wiki/README.md`](../../lib/wiki/README.md).

Version: `WIKIOS_VERSION` in `src/lib/buildVersion.ts`.
