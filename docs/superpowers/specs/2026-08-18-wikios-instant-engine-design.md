# WikiOS Instant Engine — Performance, Lightweight Caching & In-Place Editing Design

- **Date**: 2026-08-18
- **Status**: Approved
- **Domain**: WikiOS (Frontend / Architecture / Performance / Types)

---

## 1. Goal & Vision

Make **loading, reading, and editing on WikiOS instant (<50ms perceived latency) and lightweight (<50KB initial client bundle)**. Replace client-side waterfalls, monolithic components, and slow route transitions with a zero-navigation in-place architecture, multi-tier speculative caching, and CSS `content-visibility` acceleration.

---

## 2. Architecture Overview

```
                               ┌────────────────────────────────────────┐
                               │       WikiOS Client (Browser)          │
                               └────────────────────────────────────────┘
                                    │                             │
                   Hover / Viewport │ (Prefetch)                  │ Read / Edit Request
                                    ▼                             ▼
                    ┌───────────────────────────────┐  Hit (<5ms) ┌───────────────────────────┐
                    │ TanStack Query Memory Cache   │────────────▶│  WikiOS In-Place Reader   │
                    │ (stale: 10m, gc: 60m)         │             │  & Fast Editor Viewport   │
                    └───────────────────────────────┘             └───────────────────────────┘
                                    ▲                                     │
                        Cache Miss  │ Fallback Hit (<15ms)                │
                                    ▼                                     │
                    ┌───────────────────────────────┐                     │
                    │ IndexedDB Persistent LRU      │                     │
                    │ Cache (100 articles)          │                     │
                    └───────────────────────────────┘                     │
                                    ▲                                     │
                        Cold Fetch  │ (Network Request)                   │
                                    ▼                                     │
                    ┌───────────────────────────────┐                     │
                    │ tRPC Router (`api.wikios.*`)  │◀────────────────────┘
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Postgres WikiArticle Shadow   │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ MediaWiki MySQL / Action API  │
                    └───────────────────────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Layer 1: Speculative Link Prefetching & Multi-Tier Caching

1. **`useWikiPrefetch` Hook**:
   - Intercepts all internal `<a>` links matching `/wiki/[slug]`.
   - **Hover / Touchstart**: Debounced by 50ms to prevent wasted requests on rapid mouse movement.
   - **Viewport Intersection**: Visible links in the active article prefetch during browser idle periods (`requestIdleCallback`).
   - Prefetches both `wikios.getArticleHtml({ title })` and `wikios.getWikitext({ title })`.

2. **Multi-Tier Caching Pipeline**:
   - **Tier 1 (RAM)**: TanStack Query cache with `staleTime: 10 * 60 * 1000` (10 mins) and `gcTime: 60 * 60 * 1000` (1 hr).
   - **Tier 2 (IndexedDB)**: `WikiOSCacheStore` maintaining the latest 100 articles and wikitext drafts locally with LRU eviction.

3. **Background Wikitext Idle Warmup**:
   - Once an article finishes rendering in reader mode, a low-priority background task warms up the wikitext in the cache so that clicking "Edit" is **0ms**.

---

### 3.2 Layer 2: Instant In-Place Reader $\leftrightarrow$ Editor Bridge

1. **Single-Shell In-Place Editing**:
   - Eliminates Next.js full-route transitions between `/wiki/[slug]` and `/wiki/[slug]/edit`.
   - The article page maintains an active mode state (`"reading" | "editing-source" | "editing-visual"`).
   - Mode switching updates the browser URL via `window.history.pushState` with full back/forward support without unmounting the layout.

2. **Code-Split Editor Core**:
   - Heavy CodeMirror 6 syntax packages, MapLibre features, and template insertion dialogs are lazily bundled in dynamic sub-chunks.
   - The editor shell mounts immediately (<20ms) while advanced tools load on demand.

3. **Local Draft & Conflict Protection Engine**:
   - Real-time IndexedDB draft autosave with millisecond timestamp comparison.
   - Prevents edit loss on network failure or accidental tab closure.

---

### 3.3 Layer 3: DOM Performance & Layout Acceleration

1. **Native `content-visibility: auto`**:
   - Applied to `.wikios-article-section`, `.wikios-infobox-container`, and `.wikios-references`.
   - Off-screen article content skips style, layout, and paint computations until scrolled into view.
   - Initial DOM layout for 5,000+ word articles reduced from ~250ms to **<16ms**.

2. **Async Media & Image Placeholders**:
   - `decoding="async"`, `loading="lazy"`, and `fetchPriority="low"` on article imagery.
   - Shimmer skeleton placeholders eliminate cumulative layout shifts (CLS = 0).

3. **Throttled Scroll-Spy & TOC**:
   - Replaces scroll listeners with passive `IntersectionObserver` observing H2/H3 elements with 100ms throttle.

---

### 3.4 Layer 4: Monolith Decomposition & Type Safety

1. **Decomposed `ArticleRenderer.tsx`**:
   - `src/components/wiki-os/reader/ArticleHeader.tsx`
   - `src/components/wiki-os/reader/ArticleNotices.tsx`
   - `src/components/wiki-os/reader/ArticleInfobox.tsx`
   - `src/components/wiki-os/reader/ArticleContent.tsx`
   - `src/components/wiki-os/reader/ArticleCategories.tsx`
   - `src/components/wiki-os/reader/ArticleFootnotes.tsx`

2. **Decomposed Editor Modules**:
   - `src/components/wiki-os/editor/plugins/toolbar.ts`
   - `src/components/wiki-os/editor/plugins/shortcuts.ts`
   - `src/components/wiki-os/editor/plugins/syntax-wikitext.ts`

3. **Strict Branded Type Safety**:
   - `WikiSlug = Brand<string, "WikiSlug">`
   - `MediaWikiTitle = Brand<string, "MediaWikiTitle">`
   - Discriminated union states for reader, source editor, visual editor, and saving states.
   - 100% zero `any`s.

---

## 4. Verification & Testing Strategy

1. **Automated Unit & Integration Tests**:
   - Test prefetching hook (`useWikiPrefetch.test.ts`) verifying debounce and TanStack Query cache warmups.
   - Test IndexedDB cache eviction (`wikios-cache.test.ts`).
   - Test HTML transformer with `content-visibility` wrapper classes.
2. **Performance Benchmarks**:
   - Measure navigation time from link click to article interactive state (<50ms for cached links).
   - Measure time to interactive (TTI) for editor toggle (<50ms).
3. **Regression Suite**:
   - Run full regression suite across wiki, maps, and core subsystems.
