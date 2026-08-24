# 📖 WikiOS — Lore & Knowledge Operating System

**Parent App Suite:** WikiOS (`WIKIOS_VERSION = 1`)  
**Subsystems:** Native Lore Engine, Margin (`v1`), Canvas Editor (`CANVAS_VERSION = 1`), Wiki Awards (`v1`), Stash System (`STASH_VERSION = 1`), Image Repository (`REPOSITORY_VERSION = 2`)  
**Primary Action:** `PUBLISH` | **Domain Accent:** Slate Cyan (`#06B6D4` / `--color-cyan-500`)  
**Routes:** `/(wiki-os)/*`, `/(wiki-os)/editor/*`, `/stashes`, `/(wiki-os)/repository` | **Status:** 📀 Gold Master (100% Ready)  

WikiOS is the lore and knowledge operating system for IxStates. Built with native PostgreSQL storage and a sub-2ms relational link graph (`wiki_links`), it serves as an active lore platform with visual publishing, bilateral text annotations, reading queues, and editor recognition.

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
- **Primary storage.** Articles (`WikiArticle`) and revisions (`WikiRevision`) live in PostgreSQL. `getIxWikiPool()` opens a direct MariaDB connection for wikitext, categories, and backlinks.
- **Pre-compiled HTML.** `contentHtml` serves reads directly from PostgreSQL indexes in under 2ms without runtime PHP calls.
- **Relational link graph (`wiki_links`).** Indexed edges allow instant backlink lookups and red-link detection.
- **Multi-tier search.** Searches match exact titles (weight 1.0), title prefixes (weight 0.9), and fulltext keywords (weight 0.8) with batch image resolution.
- **Infobox-first image pipeline (`image-url.ts` & `mysql-reader.ts`).** Strictly prioritizes genuine infobox logo/image parameters (`| logo =`, `| image =`, `| flag =`, `| coat_of_arms =`) directly from database wikitext. Uses `isNoticeOrUtilityIcon` to block 40+ maintenance/WIP/construction badges (`Under_construction_icon-red.svg`, `Red_piston.svg`, `Ambox_warning_construction.png`). Normalizes mixed-content URLs, protocol-relative paths, and thumb paths to high-res `Special:FilePath` endpoints.

### Editorial & Sculpted Main Page Layouts (`WikiOSMainPage.tsx`)
- **Dual layout engine.** Supports both `editorial-masthead` (Atlantic/Economist-style clean typographic hierarchy) and `sculpted-emblem` (spatial floating dock).
- **Volumetric under-glow & refraction hero (`FeaturedImageRefraction.tsx`).** Hardware-accelerated ambient volumetric glow, golden-ratio containment ($1:1.618$), subtle paper grain overlay, chromatic aberration chamfers, and specular sheen on hover.
- **Deterministic daily World Almanac rotation.** Seeded 32-bit Murmur PRNG keyed on UTC date rotating through statistical ranking articles from `Category:Bureau of International Statistics`.
- **Dynamic Explore Countries deck.** Unbiased Fisher-Yates shuffle randomizing 12 featured nations across all 82 sovereign realms on each reload.
- **Tactile sound integration.** Declarative `data-cuelume-press` and `data-cuelume-hover` attributes triggering responsive Cuelume audio feedback.

### Canvas visual editor (`CANVAS_VERSION = 1`)
- **Capabilities.** Block-based document editing, infobox builders, interactive tables, bidirectional AST translation, and source or visual mode toggles.
- **Draft store.** `src/lib/wiki-os/editor/draft-store.ts` autosaves client-side drafts under `wikios_draft:${source}:${title}`.

### Export worker (`src/lib/wiki-os/adapters/mediawiki/sync-worker.ts`)
- **Background sync.** Saves complete locally in under 10ms. `MediaWikiExportWorker` pushes changes upstream to MariaDB in the background.
- **Author attribution.** The sync worker maps WikiOS edits to the author's Clerk or Ixnay account on classic MediaWiki.

### Sister-wiki federation (IIWiki and AltHistory)
- **Multi-wiki reader.** `http-reader.ts` reads external wikis (`iiwiki` and `althistory`) with 5-minute memory caching and circuit breakers.
- **Parallel dispatch.** Searching with `wikiSource: "all"` queries all three wikis concurrently with `Promise.allSettled`.

### Security and edge defense (`src/lib/wiki-os/guardian/`)
- **Cloudflare Turnstile.** Verifies human edits without CAPTCHAs.
- **Cache purge.** Triggers non-blocking Cloudflare cache purges when pages change.
- **Abuse filter.** Blocks mass page blanking (>70% text deletion) and homoglyph attacks.

---

## Backend routers (`src/server/api/routers/wikios/`)

The WikiOS router domain is split into focused files and combined with `mergeRouters`:

- `page-content.ts`. Article HTML rendering, TOC extraction, macro resolution, and classic link bridges.
- `editing.ts`. PostgreSQL primary saves, link graph updates, background MediaWiki sync, and rollbacks.
- `history.ts`. Revision history, visual diff generation, and rollback metadata.
- `search-categories.ts`. Multi-tier search, category tree queries, and batch image thumbnails.
- `user-talk.ts`. Backlinks and user discussion threads.
- `stash.ts`. Shared Lore Stash bookmarks and reading lists.

---

## Design system and style guide

- **Style guide.** Full specification in [`docs/systems/wikios/style-guide.md`](file:///home/jxsig/projects/ixstats/docs/systems/wikios/style-guide.md), following Apple Human Interface Guidelines and Emil Kowalski design engineering principles.
- **Glass physics.** Hardware-accelerated backdrop blur (`blur(20px) saturate(180%)`), chamfered edge glare overlays, and calibrated light or dark surface tokens in [`src/styles/wiki-os/cards.css`](file:///home/jxsig/projects/ixstats/src/styles/wiki-os/cards.css) and [`variables.css`](file:///home/jxsig/projects/ixstats/src/styles/wiki-os/variables.css).
- **Proportional typography.** Proportional type for all headings and body text (`Host Grotesk` display, `Geist Sans` reading), paired with `tabular-nums` for numeric alignment. Clean section headers without arbitrary indicator dots.
- **Spring motion.** Critically damped spring curves (`stiffness: 400, damping: 24`), origin-aware popovers, and instant `:active` scale (`scale(0.97)`) touch feedback across all pressable components.
