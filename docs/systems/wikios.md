# 📖 WikiOS — Lore & Knowledge Operating System

**Parent App Suite:** WikiOS (`WIKIOS_VERSION = 1`)  
**Subsystems:** Native Lore Engine, Margin, Canvas Editor (`CANVAS_VERSION = 1`), Lorewards & article awards (`WikiArticleAward`; versioned with Achievements, `ACHIEVEMENTS_VERSION = 2`), Stash System (`STASH_VERSION = 1`), Image Repository (`REPOSITORY_VERSION = 2`)  
**Primary Action:** `PUBLISH` | **Domain Accent:** Slate Cyan (`#06B6D4` / `--color-cyan-500`)  
**Routes:** `/wiki/*` (reader, `/wiki/[slug]/edit`, `?source=` foreign-wiki pages), `/util/*` (utility pages incl. `/util/repository`), `/stashes` | **Status:** Release Candidate (platform 1.4.0)  

WikiOS is the lore and knowledge operating system for IxStates. Built with native PostgreSQL storage (no direct MariaDB connection; MediaWiki is reached only over its HTTP Action API) and a sub-2ms relational link graph (`wiki_links`), it serves as an active lore platform with visual publishing, bilateral text annotations, reading queues, and editor recognition.

---

## Core Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   WIKIOS PRIMARY APP ARCHITECTURE (src/app/(wiki-os)/)                 │
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ 1. Native Reader   │ 2. Margin          │ 3. Canvas Editor   │ 4. Media & Metagame     │
│ PostgreSQL CRUD,   │ Split-canvas sheet,│ Visual block-based │ Image repository,       │
│ sub-2ms link graph,│ gutter text pins,  │ rich text editor   │ Wiki Awards medals,     │
│ TOC & live embeds  │ bilateral threads  │ with live blocks   │ Stash reading lists     │
└────────────────────┴────────────────────┴────────────────────┴─────────────────────────┘
```

### Direct database engine (`src/lib/wiki-os/`)
- **Primary storage.** Articles (`WikiArticle`) and revisions (`WikiRevision`) live in PostgreSQL. All 4,685+ namespace-0 articles and 48,200+ relational link edges are stored natively.
- **Pre-compiled HTML.** `contentHtml` serves reads directly from PostgreSQL indexes in under 2ms without runtime PHP calls.
- **Relational link graph (`wiki_links`).** Indexed edges allow instant backlink lookups and red-link detection in <1ms.
- **Multi-tier search.** Spotlight autocomplete scores exact titles 1.0, title prefixes 0.8, and other trigram matches 0.5; deep search uses a weighted `tsvector` query with snippets (`NativeSearchService`).
- **Native Media & Asset Engine (`MediaAssetService` & `wiki_assets`).** Full native registry of 7,555+ images, SVG emblems, flags, and media files stored directly in PostgreSQL (`wiki_assets`). 
  - **Zero Duplication**: Master binaries remain in single-copy storage; PostgreSQL indexes lightweight metadata pointers (`slug`, `width`, `height`, `mimeType`, `@unique md5Hash`).
  - **JIT & Save-Time Auto-Registration**: `ArticleRepository.saveArticle` and `/api/mediawiki/ixwiki/[...path]` automatically extract and register new media assets into `wiki_assets` in background (<10ms).
  - **Zero CLS & Immutable Caching**: Serves pre-computed width, height, and thumbnail variants with `Cache-Control: public, max-age=31536000, immutable` for zero cumulative layout shift.
- **Infobox-first image pipeline (`transformers/image-url.ts`).** Strictly prioritizes genuine infobox logo/image parameters (`| logo =`, `| image =`, `| flag =`, `| coat_of_arms =`) from stored wikitext (`extractLeadImageFromWikitext`). Uses `isNoticeOrUtilityIcon` to block 40+ maintenance/WIP/construction badges (`Under_construction_icon-red.svg`, `Red_piston.svg`, `Ambox_warning_construction.png`). Normalizes mixed-content URLs, protocol-relative paths, and thumb paths to high-res `Special:FilePath` endpoints.

### Editorial & Sculpted Main Page Layouts (`WikiOSMainPage.tsx`)
- **Dual layout engine.** Supports both `editorial-masthead` (Atlantic/Economist-style clean typographic hierarchy) and `sculpted-emblem` (spatial floating dock).
- **Volumetric under-glow & refraction hero (`FeaturedImageRefraction.tsx`).** Hardware-accelerated ambient volumetric glow, golden-ratio containment ($1:1.618$), subtle paper grain overlay, chromatic aberration chamfers, and specular sheen on hover.
- **Deterministic daily World Almanac rotation.** Seeded 32-bit Murmur PRNG keyed on UTC date rotating through statistical ranking articles from `Category:Bureau of International Statistics`.
- **Dynamic Explore Countries deck.** Unbiased Fisher-Yates shuffle randomizing 12 featured nations across all 82 sovereign realms on each reload.
- **Tactile sound integration.** Declarative `data-cuelume-press` and `data-cuelume-hover` attributes triggering responsive Cuelume audio feedback.

### Canvas visual editor (`CANVAS_VERSION = 1`) & Immersion Navigation
- **Immersion Mode (Mode 2: HIDDEN).** Operates in distraction-free focus mode (`/wiki/*`, `/blurbs/*`): the top navbar starts translated `-100%` and smoothly reveals on upward scroll (>10px) or top-edge hover (<=16px), while `WikiHalo` remains interactive.
- **Dynamic Repulsion Physics.** Visual and Source editor titlebars dynamically repulse under the sticky Halo capsule using $\text{clamp}(\text{scrollY} / 56, 0, 1)$, gliding the mode switch upward and tucking actions without layout shift.
- **Capabilities.** Block-based document editing, infobox builders, interactive tables, bidirectional AST translation, and source or visual mode toggles.
- **Draft store.** `src/lib/wiki-os/editor/draft-store.ts` autosaves client-side drafts under `wikios_draft:${source}:${title}`.

### Export worker (`src/lib/wiki-os/adapters/mediawiki/sync-worker.ts`)
- **Background sync.** Saves complete locally in under 10ms. `MediaWikiExportWorker` (in-process queue) pushes changes upstream through the MediaWiki Action API (`action=edit`) in the background; set `SKIP_MEDIAWIKI_SYNC=true` to disable.
- **Author attribution.** Authorship is recorded in PostgreSQL (`WikiRevision.author` / `authorId`). Upstream edits are made with the shared bot session; per-user actor patching on classic MediaWiki is not implemented (`updateRevisionActor` is a no-op).
- **Inbound sync.** Edits made directly on classic MediaWiki are pulled into PostgreSQL by `services/auto-sync-service.ts` (`runAutoSyncCycle`), run by the `wiki-recentchanges` cron job and the `/api/wikios/inbound-sync` webhook.

### Sister-wiki federation (IIWiki and AltHistory)
- **Multi-wiki reader.** `http-reader.ts` reads external wikis (`iiwiki` and `althistory`); a host that returns 403/offline is skipped for 5 minutes (circuit breaker).
- **Foreign-wiki pages.** `/wiki/[slug]?source=iiwiki|althistory` renders another wiki's page read-only: links stay on that wiki, and editing, Watch, `?margin` and the Halo follow the page's wiki (Sept 2026 rulings E-l/E-m).
- **Parallel dispatch.** Searching with `wikiSource: "all"` queries all three wikis concurrently with `Promise.all`.

### Security and edge defense (`src/lib/wiki-os/guardian/`)
- **Cloudflare Turnstile.** Verifies human edits without CAPTCHAs when the client sends a token (`saveWikitext` accepts an optional `turnstileToken`).
- **Cache purge.** Triggers non-blocking Cloudflare cache purges when pages change.
- **Abuse filter.** Not implemented: there is no mass-blanking or homoglyph filter in the save path. The editor client blocks saves that lost content (plans 203/301).

---

## Backend routers (`src/server/api/routers/wikios/`)

The WikiOS router domain is split into focused files and combined with `mergeRouters`:

- `page-content.ts`. Article HTML rendering, TOC extraction, macro resolution, and classic link bridges.
- `editing.ts`. PostgreSQL primary saves, link graph updates, background MediaWiki sync, and rollbacks.
- `history-diff.ts`. Revision history, diffs, and revision content.
- `search.ts` and `categories.ts`. Multi-tier search, recent changes, site stats, and category tree queries.
- `templates.ts`. Template search, TemplateData, and previews.
- `user-talk.ts`. User info, contributions, author profiles, and backlinks.
- `discussions.ts`. Margin threads and comments.
- `watchlist-annotations.ts`. Watchlist and Stash text annotations.
- `stash.ts`. Lore Stash collections and items.
- `utilities.ts`. Maintenance reports (orphans, dead ends, broken redirects), audit logs, and health telemetry.

---

## Design system and style guide

- **Style guide.** Full specification in [`docs/systems/wikios/style-guide.md`](wikios/style-guide.md), following Apple Human Interface Guidelines and Emil Kowalski design engineering principles.
- **Glass physics.** Hardware-accelerated backdrop blur (`blur(20px) saturate(180%)`), chamfered edge glare overlays, and calibrated light or dark surface tokens in `src/styles/wiki-os/foundations.css` and `components.css`.
- **Proportional typography.** Proportional type for all headings and body text (`Host Grotesk` display, `Geist Sans` reading), paired with `tabular-nums` for numeric alignment. Clean section headers without arbitrary indicator dots.
- **Spring motion.** Critically damped spring curves (`stiffness: 400, damping: 24`), origin-aware popovers, and instant `:active` scale (`scale(0.97)`) touch feedback across all pressable components.
