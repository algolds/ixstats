# 📖 Stash — Personal Reading Lists & Lore Archives

**Last updated:** 2026-09-30

**Parent App Suite:** WikiOS (`WIKIOS_VERSION = 1`)  
**Subsystem:** Stash (`STASH_VERSION = 1`)  
**Primary Action:** `STASH` | **Domain Accent:** Crimson Rose (`#f43f5e` / rose-500, see [stash-style-guide.md](stash-style-guide.md))  
**Route:** `/stashes` | **Status:** Release Candidate (platform 1.4.0)  
*(Stash is WikiOS's storage, but not WikiOS-only: forum threads (`forum/stash.ts`, `contentType: "forum_thread"`), the Onoma Name Bank (`onoma/namebank.ts`, `contentType` `name` and `dictionary`), lore cards (`lore-cards/wiki.ts`) and the media editor (`commons:`-prefixed titles) also write `StashItem` rows. The `StashItem.contentType` comment in `wiki.prisma` lists only `wiki | forum_thread | forum_post`.)*  
*(Note: Prisma models are `Stash` / `StashItem` / `StashAnnotation`; the tables keep the legacy `lore_stash*` names)*  

---

## 1. Overview and Philosophy

> **"Save-for-later, built for lore."**

Stash is the universal research vault for IxStates and WikiOS. 

Worldbuilders, diplomats, and alliance commanders routinely read hundreds of articles, treaties, and forum debates. Before Stash, players juggled dozens of open browser tabs, lost bookmarks, scattered Google Docs, and loose reference images on desktop folders. 

Stash consolidates this workflow into a single, structured system. It stores full wiki pages, clipped quotes, reference images, and forum discussions in color-coded collections that synchronize across devices.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 4 STASH CONTENT PILLARS                     │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│ 1. Articles      │ 2. Quotes        │ 3. Media         │ 4. Threads    │
│ Full wiki pages, │ Clipped excerpts │ Wikimedia & local│ Saved forum   │
│ lead thumbnails, │ synced two-way   │ graphics, aspect │ debates and   │
│ word counts, and │ with WikiOS      │ ratios, and      │ policy logs   │
│ personal notes   │ Margin highlights│ lightbox viewer  │ with summaries│
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

## 2. Core Capabilities

### 2.1 Color-Coded Collections
Users organize items into custom collections (e.g. *Treaties*, *Fleet Doctrine*, *Prime Ministers*). Each collection has:
- A custom title (up to 100 characters).
- An assigned color tag chosen from the 8-color preset palette.
- An ordering index for drag or spring-based sorting.
- A default system collection (*"My Stash"*) that cannot be deleted.

### 2.2 Four Content Domains
1. **Articles Tab**:
   - Saves MediaWiki and WikiOS articles.
   - Automatically resolves lead image thumbnails via `/api/mediawiki/ixwiki/` proxy.
   - Tracks save date and user note.
   - Shows attached highlight badges.
2. **Quotes & Highlights Tab**:
   - Two-way sync with the WikiOS Margin annotation system.
   - Stores selected text, color highlights, and lore notes.
   - Provides a one-click copy button and direct anchor link back to the article section.
3. **Media Tab**:
   - Saves images from the WikiOS media repository (stored as `commons:`-prefixed items).
   - Includes one-click wikitext snippet copying (`[[File:...|thumb]]`) and full-screen lightbox inspection.
4. **Discussions Tab**:
   - Bookmarks forum threads from regional and alliance boards.
   - Stores custom summary notes and direct links to the live forum thread.

### 2.3 Universal Popover Management
In accordance with Apple Design standards:
- **Collection Creation**: Triggered via `CreateStashPopover.tsx`, opening an anchored popover with zero page layout shift.
- **Collection Settings**: Managed via `StashSettingsMenu.tsx`, providing inline renaming, 8-swatch color tag switching, share link copying (copies a `/stashes?stash=<id>` URL; the page does not read the parameter yet, and stashes are private to their owner), Markdown/JSON exporting, and destructive deletion with safety confirmation.

### 2.4 Dual Export Engine
Collections can be exported at any time:
- **Markdown (`.md`)**: Generates formatted markdown with article headers, blockquoted citations, media lists, and discussion links.
- **JSON (`.json`)**: Exports complete structured data for programmatic backups, API consumption, or offline archiving.

---

## 3. Architecture & Data Flow

```
                     ┌───────────────────────────┐
                     │   WikiOS Reader & Margin  │
                     └─────────────┬─────────────┘
                                   │
                     ┌─────────────▼─────────────┐
                     │ Selection Capsule / Action │
                     │   [ Highlight | Stash ]   │
                     └─────────────┬─────────────┘
                                   │ tRPC (api.wikios.*)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVER & DATABASE LAYER                         │
├────────────────────────────────────────────────────────────────────────┤
│ • Router: src/server/api/routers/wikios/stash.ts                      │
│ • Annotations: src/server/api/routers/wikios/watchlist-annotations.ts │
│ • Models: Stash, StashItem, StashAnnotation (PostgreSQL)              │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STASH HUB (/stashes)                            │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│ StashSidebar.tsx │ StashPagesList   │ StashQuotesList  │ StashImages   │
│ Collection rail, │ Article cards,   │ Clipped quotes,  │ 4-col gallery,│
│ color swatches,  │ thumbnails, and  │ 2-way Margin sync│ lightbox, and │
│ inline rename    │ reading links    │ and copy button  │ wikitext copy │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

## 4. Database Schema Reference

The database models are defined in `prisma/schema/wiki.prisma`. The Prisma models are named `Stash`, `StashItem`, and `StashAnnotation`; the underlying tables keep the legacy `lore_` prefix (`lore_stashes`, `lore_stash_items`, `lore_stash_annotations`).

### Stash (`lore_stashes`)
```prisma
model Stash {
  id        String      @id @default(cuid())
  userId    String
  name      String      @default("My Stash")
  color     String      @default("#3b82f6")
  icon      String?
  isDefault Boolean     @default(false)
  order     Int         @default(0)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  items     StashItem[]

  @@unique([userId, name])
  @@index([userId])
  @@index([userId, isDefault])
  @@map("lore_stashes")
}
```

### StashItem (`lore_stash_items`)
```prisma
model StashItem {
  id          String            @id @default(cuid())
  stashId     String
  pageTitle   String            // "commons:" prefix = image, "forum:thread:" prefix = thread
  pageSlug    String
  articleId   String?           // optional link to WikiArticle
  contentType String            @default("wiki") // "wiki" | "forum_thread" | "forum_post"
  contentId   Int?              // XenForo thread_id or post_id for forum items
  note        String?
  order       Int               @default(0)
  savedAt     DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  stash       Stash             @relation(fields: [stashId], references: [id], onDelete: Cascade)
  annotations StashAnnotation[]

  @@unique([stashId, pageTitle])
  @@map("lore_stash_items")
}
```

### StashAnnotation (Margin highlights, `lore_stash_annotations`)
```prisma
model StashAnnotation {
  id             String    @id @default(cuid())
  itemId         String
  anchorSelector String
  anchorOffset   Int
  focusSelector  String
  focusOffset    Int
  selectedText   String
  comment        String?
  color          String    @default("#fbbf24")
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  item           StashItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId])
  @@map("lore_stash_annotations")
}
```

Annotations hang off a `StashItem`. When a highlight is made on a page that is not stashed yet, `addAnnotation` creates the item in the user's default stash first.

---

## 5. tRPC API Reference

All operations are grouped under `api.wikios.*`: collection and item procedures in `src/server/api/routers/wikios/stash.ts`, annotation procedures in `watchlist-annotations.ts`, and thumbnails in `page-content.ts`. Forum threads use `api.forum.stashThread` / `unstashThread` / `isThreadStashed` / `getStashedThreads`.

| Procedure | Type | Input | Description |
| :--- | :--- | :--- | :--- |
| `getStashes` | Query | `void` | Returns all collections for the active user with item counts. |
| `getStashItems` | Query | `{ stashId: string, limit?, cursor? }` | Paginated articles, images, and threads for the specified collection. |
| `createStash` | Mutation | `{ name: string, color: string, icon?: string }` | Creates a new collection (max 25 per user). |
| `updateStash` | Mutation | `{ id: string, name?, color?, icon? }` | Renames collection or updates color/icon. |
| `deleteStash` | Mutation | `{ id: string }` | Deletes a non-default collection and cascades to its items. |
| `stashPage` | Mutation | `{ pageTitle: string, stashId?: string, contentType?: string, contentId?: number, … }` | Saves an article, image, or thread (default stash if none given). |
| `unstashPage` | Mutation | `{ pageTitle: string, stashId?: string }` | Removes item from collection. |
| `isStashed` | Query | `{ pageTitle: string }` | Checks whether active user has stashed this page. |
| `getAnnotations` | Query | `{ pageTitle: string }` | Fetches clipped quotes and Margin highlights for a page. |
| `addAnnotation` | Mutation | `{ itemId? \| pageTitle?, anchorSelector, anchorOffset, focusSelector, focusOffset, selectedText, comment?, color? }` | Clips a text excerpt (creates the item in the default stash if needed). |
| `deleteAnnotation` | Mutation | `{ id: string }` | Deletes clipped quote. |
| `getArticleThumbnails` | Query | `{ titles: string[] }` | Batch resolves lead article image thumbnails. |

---

## 6. Frontend Component Architecture

All components live in `src/components/wiki-os/stashes/`:

| Component | Responsibility |
| :--- | :--- |
| [`StashSidebar.tsx`](../../src/components/wiki-os/stashes/StashSidebar.tsx) | Collection rail with preset color pills, inline rename, count badges, and delete confirmation. |
| [`StashPagesList.tsx`](../../src/components/wiki-os/stashes/StashPagesList.tsx) | Article card list with lead image thumbnail fallback to `WikiOSLogomark`, highlight counts, and note badges. |
| [`StashQuotesList.tsx`](../../src/components/wiki-os/stashes/StashQuotesList.tsx) | Dedicated reader for clipped quotes and Margin highlights with copy button and article anchors. |
| [`StashImagesGrid.tsx`](../../src/components/wiki-os/stashes/StashImagesGrid.tsx) | 4-column responsive media gallery with aspect ratio badges, lightbox, and wikitext copy. |
| [`StashThreadsList.tsx`](../../src/components/wiki-os/stashes/StashThreadsList.tsx) | Bookmarked forum discussion cards with direct links and user summary text. |
| [`StashSettingsMenu.tsx`](../../src/components/wiki-os/stashes/StashSettingsMenu.tsx) | Apple Design settings popover with rename, 8-swatch picker, MD/JSON export, share, and delete. |
| [`CreateStashPopover.tsx`](../../src/components/wiki-os/stashes/CreateStashPopover.tsx) | Non-disruptive creation popover anchored to trigger button. |
| [`StashWelcomeModal.tsx`](../../src/components/wiki-os/shared/StashWelcomeModal.tsx) | Un-slopped 4-tab user guide explaining core features and workflows. |
