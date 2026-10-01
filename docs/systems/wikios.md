# 📖 WikiOS — Lore & Knowledge Operating System

**Parent App Suite:** WikiOS (`WIKIOS_VERSION = 1`)  
**Subsystems:** Native Lore Engine, Margin, Canvas Editor (`CANVAS_VERSION = 1`), Lorewards & article awards (`WikiArticleAward`; versioned with Achievements, `ACHIEVEMENTS_VERSION = 2`), Stash System (`STASH_VERSION = 1`), Image Repository (`REPOSITORY_VERSION = 2`)  
**Primary Action:** `PUBLISH` | **Domain Accent:** Slate Cyan (`#06B6D4` / `--color-cyan-500`)  
**Routes:** `/wiki/*` (reader, `/wiki/[slug]/edit`, `?source=` foreign-wiki pages), `/util/*` (utility pages incl. `/util/repository`), `/stashes` | **Status:** Release Candidate (platform 1.4.0)  

WikiOS is the lore and knowledge operating system for IxStates. Built with native PostgreSQL storage (no direct MariaDB connection; MediaWiki is reached only over its HTTP Action API, and remains the renderer for templates, Lua and the Main Page) and an indexed relational link graph (`wiki_links`), it serves as an active lore platform with visual publishing, bilateral text annotations, reading queues, and editor recognition.

---

## Core Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   WIKIOS PRIMARY APP ARCHITECTURE (src/app/(wiki-os)/)                 │
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ 1. Native Reader   │ 2. Margin          │ 3. Canvas Editor   │ 4. Media & Metagame     │
│ PostgreSQL CRUD,   │ Split-canvas sheet,│ Visual block-based │ Image repository,       │
│ indexed link graph,│ gutter text pins,  │ rich text editor   │ Wiki Awards medals,     │
│ TOC & live embeds  │ bilateral threads  │ with live blocks   │ Stash reading lists     │
└────────────────────┴────────────────────┴────────────────────┴─────────────────────────┘
```

### Direct database engine (`src/lib/wiki-os/`)
- **Primary storage.** Articles (`WikiArticle`) and revisions (`WikiRevision`) live in PostgreSQL. All 4,685+ namespace-0 articles and 48,200+ relational link edges are stored natively.
- **Edit policy.** `checkEditPolicy` (`src/lib/wiki-os/namespace-policy.ts`) lets signed-in users edit Main and the talk namespaces, plus their own `User:` page once their wiki account link is verified (not `.js`/`.css`/`.json`/`.less` subpages). Every other namespace is admin-only, and Special/Media are never editable.
- **`contentHtml` cache.** `WikiArticle.contentHtml` is served when present, but `ArticleRepository.saveArticle` stores an empty string unless the caller supplies HTML, so the next read of a saved article renders it again through MediaWiki (`action=parse`, with a timeout). Reads ask MediaWiki for author data (`http-reader.ts`), with the result cached. There is no measured sub-2ms, no-PHP read path today: PostgreSQL is authoritative for stored wikitext, revisions and the link graph, not for rendering, templates, Lua, uploads, image bytes or the Main Page.
- **Relational link graph (`wiki_links`).** Indexed edges allow indexed backlink lookups and red-link detection.
- **Multi-tier search.** Spotlight autocomplete is a case-insensitive Prisma `contains` on titles that scores exact titles 1.0, prefixes 0.8 and other matches 0.5 (`NativeSearchService`); it is not trigram or typo-tolerant, and there is no `pg_trgm` extension or GIN index on `wiki_articles`. Deep search computes a weighted `tsvector` query with snippets at query time, with no index behind it.
- **Native Media & Asset Engine (`MediaAssetService` & `wiki_assets`).** Registry of 7,555+ images, SVG emblems, flags, and media files as `wiki_assets` rows. Assets are metadata pointers to images hosted on ixwiki.com; uploads are not served from WikiOS storage. 
  - **Metadata pointers**: PostgreSQL holds lightweight rows (`slug`, `width`, `height`, `mimeType`, `@unique md5Hash`). `md5Hash` is the MD5 of the filename (`core/media-asset-service.ts`), so it de-duplicates names, not content.
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

### Mirror worker (`src/lib/wiki-os/services/mirror-worker.ts`, plan 407)
- **Durable outbox.** Saves complete locally in under 10ms. A save inserts a `WikiMirrorJob` row (`wiki_mirror_jobs`) in the same transaction as the revision, so a committed edit always has its job; moves, deletes, undeletes and protections queue their own jobs in the transaction of their `WikiLog` row. The worker (cron job `wiki-mirror`, every minute, plus an in-process run about 2 seconds after a write under the same job lock) applies the jobs per title in order. A failed job backs off (`min(2^attempts x 30 s, 1 h)`) and goes `dead` after 8 attempts (Discord warning); an administrator requeues or discards it in the WikiOS settings panel (`getMirrorStatus`, `requeueMirrorJob`, `discardMirrorJob`). `SKIP_MEDIAWIKI_SYNC=true` stops the worker; the jobs accumulate.
- **Author attribution.** A revision is mirrored through `action=import` with `assignknownusers=1`: MediaWiki credits it to the account of the author's verified wiki link (else the author's name; an unknown name becomes `wikios>Name`), dated as WikiOS made it. Moves, deletes and protections are made by the bot account. The bot is the dedicated `WikiOSMirror` account (`WIKIOS_MEDIAWIKI_BOT_USER` / `_TOKEN` in `src/env.ts`, no default, group `wikios-mirror`); a failed login fails the job and never falls back to an anonymous session.
- **Inbound sync.** Edits made directly on classic MediaWiki are pulled into PostgreSQL by `services/auto-sync-service.ts` (`runAutoSyncCycle`), run by the `wiki-recentchanges` cron job and the `/api/wikios/inbound-sync` webhook.

### Sister-wiki federation (IIWiki and AltHistory)
- **Multi-wiki reader.** `http-reader.ts` reads external wikis (`iiwiki` and `althistory`); a host that returns 403/offline is skipped for 5 minutes (circuit breaker).
- **Foreign-wiki pages.** `/wiki/[slug]?source=iiwiki|althistory` renders another wiki's page read-only: links stay on that wiki, and editing, Watch, `?margin` and the Halo follow the page's wiki (Sept 2026 rulings E-l/E-m).
- **Parallel dispatch.** Searching with `wikiSource: "all"` queries all three wikis concurrently with `Promise.all`.

### Security and edge defense (`src/lib/wiki-os/guardian/`)
- **Cloudflare Turnstile.** `saveWikitext` accepts an optional `turnstileToken` and calls `CloudflareGuardian.verifyTurnstile` when one is sent, but the result is ignored and no client sends a token, so it does not block anything today.
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
