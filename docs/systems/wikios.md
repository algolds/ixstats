# WikiOS System Documentation

**Last updated:** August 2026  
**Status:** Production Ready (Beta) — WikiOS v1  
**Hierarchy:** Top-level App **WikiOS** (`WIKIOS_VERSION = 1` in Version Registry). Canvas sub-system `CANVAS_VERSION = 1`.

WikiOS is the modern Next.js reading, authoring, and knowledge platform within IxStates that replaces the traditional MediaWiki frontend UI. It combines a rich visual block editor (PlateJS), MediaWiki Parsoid API synchronization, direct SQL cache acceleration, multimedia commons exploration, and natural voice article narration.

---

## Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WIKIOS APP (src/app/(wiki-os)/)                      │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│ 1. Reader & Nav  │ 2. Canvas Editor │ 3. Audio Player │ 4. Commons Hub │
│ PlateJS parser,  │ Visual block-    │ Kokoro TTS      │ Image explorer,│
│ Parsoid sync,    │ based rich text  │ narrator, Halo  │ SVG heraldry,  │
│ Stash bookmarks  │ editor (v1)      │ audio equalizer │ MediaWiki sync │
└──────────────────┴──────────────────┴─────────────────┴────────────────┘
```

### 1. Canvas (Visual Wiki Editor)
- **Version**: `CANVAS_VERSION = 1` (sub-system under WikiOS)
- **Capabilities**: Block-based visual document editing powered by PlateJS, infobox template builders, interactive tables, and bidirectional wikitext translation.

### 2. Article Narrator (Onoma Voice Integration)
- **Engine**: Kokoro TTS (`kokoro-fastapi` / `kokoro-web`) phoneme synthesis.
- **Dynamic Island (Halo)**: Live audio equalizer waveform in compact pill, scrubber track and heading jump markers in expanded view.

### 3. MediaWiki Decoupling & Direct SQL Cache Engine
- **Centralized Primitives**: All MediaWiki requests strictly use `IxStats-Builder` user-agent (`src/lib/wiki/config.ts`).
- **Instant Engine**: Direct read cache against MariaDB replicas with Redis fallback, resolving article loads in $<10\text{ms}$.

### 4. Stash (Save for Later)
- **Version**: `STASH_VERSION = 1` (formerly "LoreStash")
- **Capabilities**: Cross-system article bookmarking, reading lists, offline access, and research trays available across WikiOS, Forum, and ThinkPages.

### 5. Repository & Commons
- **Version**: `REPOSITORY_VERSION = 2` (WikiOS Commons image explorer)
- **Router**: `src/server/api/routers/commons.ts` & `src/server/api/routers/heraldry/`
- **Capabilities**: Asset search, SVG coat of arms inspector, and license attribution tracking.

---

## Backend Routers (`src/server/api/routers/`)

- `wikios/` (`index.ts`, `articles.ts`, `revisions.ts`, `search.ts`, `categories.ts`) – Article CRUD and metadata
- `wikiCache.ts` – Redis and memory caching layer
- `wikiImporter/` – Batch wikitext importing and infobox parser
- `lorewards/` – Wiki contribution medals and scoring
- `commons.ts` – Commons media asset explorer
- `heraldry/` – National coats of arms and flag vectors
- `blurbs/` – Short-form article summaries for social sharing
- `narrator/` – Article sentence chunking and TTS synthesis proxy

---

## Data Models

Defined in `prisma/schema/wiki.prisma`:
- `WikiPage`: Authoritative page metadata, namespace, title, revision ID, cache status
- `WikiRevision`: Immutable revision history with author, timestamp, diff summary
- `WikiCategory`: Category hierarchy tree
- `LoreWard`: User awards earned through wiki contribution milestones
- `StashItem`: Bookmarked articles, forum threads, and lore cards linked to `User`

---

## Related Documentation

- [Onoma Voice & Kokoro TTS Guide](./onoma-voice-guide.md)
- [Halo Plugin System](./dynamic-island.md)
- [Social & Collaboration System](./social.md)
- [API Reference: WikiOS Routers](../reference/api-complete.md#wikios-router)
