# 📖 Stash — Personal Reading Lists & Lore Archives

**Parent App Suite:** WikiOS (`WIKIOS_VERSION = 1`)  
**Subsystem:** Stash (`STASH_VERSION = 1`)  
**Primary Action:** `STASH` | **Domain Accent:** Slate Cyan (`#06B6D4` / `--color-cyan-500`)  
**Route:** `/stashes` | **Status:** 📀 Gold Master (100% Ready)  
*(Note: Prisma models retain the `LoreStash` schema name for database stability)*  

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
   - Tracks save date, word count, and user note.
   - Shows attached highlight badges.
2. **Quotes & Highlights Tab**:
   - Two-way sync with the WikiOS Margin annotation system.
   - Stores selected text, color highlights, and lore notes.
   - Provides a one-click copy button and direct anchor link back to the article section.
3. **Media Tab**:
   - Saves Wikimedia Commons graphics and user image uploads.
   - Shows aspect ratio tags (`16:9`, `4:3`, `1:1`, `Square`, `Portrait`).
   - Includes one-click wikitext snippet copying (`[[File:...|thumb]]`) and full-screen lightbox inspection.
4. **Discussions Tab**:
   - Bookmarks forum threads from regional and alliance boards.
   - Stores custom summary notes and direct links to the live forum thread.

### 2.3 Universal Popover Management
In accordance with Apple Design standards:
- **Collection Creation**: Triggered via `CreateStashPopover.tsx`, opening an anchored popover with zero page layout shift.
- **Collection Settings**: Managed via `StashSettingsMenu.tsx`, providing inline renaming, 8-swatch color tag switching, share link copying, Markdown/JSON exporting, and destructive deletion with safety confirmation.

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
│ • Bridge: src/lib/wiki-os/adapters/mediawiki/bridge/mysql-reader.ts     │
│ • Models: LoreStash, LoreStashItem, PageAnnotation (PostgreSQL)       │
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

The database models are defined in `prisma/schema/wiki.prisma`:

### LoreStash
```prisma
model LoreStash {
  id          String          @id @default(cuid())
  userId      String
  name        String          @default("My Stash")
  color       String          @default("#f43f5e")
  icon        String?
  isDefault   Boolean         @default(false)
  order       Int             @default(0)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  items       LoreStashItem[]
  annotations PageAnnotation[]

  @@unique([userId, name])
  @@index([userId])
}
```

### LoreStashItem
```prisma
model LoreStashItem {
  id          String    @id @default(cuid())
  stashId     String
  pageTitle   String
  pageSlug    String
  contentType String    @default("article") // "article" | "image" | "thread"
  note        String?   @db.Text
  order       Int       @default(0)
  createdAt   DateTime  @default(now())

  stash       LoreStash @relation(fields: [stashId], references: [id], onDelete: Cascade)

  @@unique([stashId, pageTitle])
  @@index([stashId])
}
```

### PageAnnotation (Margin Sync)
```prisma
model PageAnnotation {
  id           String     @id @default(cuid())
  stashId      String
  pageTitle    String
  pageSlug     String
  selectedText String     @db.Text
  comment      String?    @db.Text
  color        String     @default("yellow")
  startOffset  Int?
  endOffset    Int?
  context      String?    @db.Text
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  stash        LoreStash  @relation(fields: [stashId], references: [id], onDelete: Cascade)

  @@index([stashId, pageTitle])
}
```

---

## 5. tRPC API Reference

All operations are grouped under `api.wikios.*` in `src/server/api/routers/wikios/stash.ts`:

| Procedure | Type | Input | Description |
| :--- | :--- | :--- | :--- |
| `getStashes` | Query | `void` | Returns all collections for the active user with item counts. |
| `getStashItems` | Query | `{ stashId?: string }` | Returns articles, images, and threads for the specified collection. |
| `createStash` | Mutation | `{ name: string, color?: string }` | Creates a new collection with preset color tag. |
| `updateStash` | Mutation | `{ id: string, name: string, color: string }` | Renames collection or updates theme color. |
| `deleteStash` | Mutation | `{ id: string }` | Deletes a non-default collection and cascades to its items. |
| `stashPage` | Mutation | `{ pageTitle: string, stashId?: string, contentType?: string, note?: string }` | Saves an article, image, or thread. |
| `unstashPage` | Mutation | `{ pageTitle: string, stashId?: string }` | Removes item from collection. |
| `isStashed` | Query | `{ pageTitle: string }` | Checks whether active user has stashed this page. |
| `getAnnotations` | Query | `{ pageTitle?: string, stashId?: string }` | Fetches clipped quotes and Margin highlights. |
| `addAnnotation` | Mutation | `{ pageTitle, pageSlug, selectedText, comment?, color?, context? }` | Clips text excerpt to active collection. |
| `deleteAnnotation` | Mutation | `{ id: string }` | Deletes clipped quote. |
| `getArticleThumbnails` | Query | `{ titles: string[] }` | Batch resolves lead article image thumbnails. |

---

## 6. Frontend Component Architecture

All components live in `src/components/wiki-os/stashes/`:

| Component | Responsibility |
| :--- | :--- |
| [`StashSidebar.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashSidebar.tsx) | Collection rail with preset color pills, inline rename, count badges, and delete confirmation. |
| [`StashPagesList.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashPagesList.tsx) | Article card list with lead image thumbnail fallback to `WikiOSLogomark`, highlight counts, and note badges. |
| [`StashQuotesList.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashQuotesList.tsx) | Dedicated reader for clipped quotes and Margin highlights with copy button and article anchors. |
| [`StashImagesGrid.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashImagesGrid.tsx) | 4-column responsive media gallery with aspect ratio badges, lightbox, and wikitext copy. |
| [`StashThreadsList.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashThreadsList.tsx) | Bookmarked forum discussion cards with direct links and user summary text. |
| [`StashSettingsMenu.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/StashSettingsMenu.tsx) | Apple Design settings popover with rename, 8-swatch picker, MD/JSON export, share, and delete. |
| [`CreateStashPopover.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/stashes/CreateStashPopover.tsx) | Non-disruptive creation popover anchored to trigger button. |
| [`StashWelcomeModal.tsx`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/shared/StashWelcomeModal.tsx) | Un-slopped 4-tab user guide explaining core features and workflows. |
