# Specification: Wiki Author & Contributor Attribution System

## 1. Overview & Goals
Provides an automated, highly accurate mechanism to discover, parse, format, and persist the **Page Creator** and **Primary Contributor** for wiki lore cards across IxWiki and IIWiki.

### Key Capabilities
- **Accurate Page Creator Discovery**: Extracts the original page author from revision 1 via MediaWiki API (`prop=revisions&rvdir=newer&rvprop=user|timestamp`), filtering out automated import bots and system accounts.
- **Top Contributor Detection**: Queries `prop=contributors` to identify the most active non-creator editor.
- **Dual Attribution Formatting**:
  - Same User / Solo Author: `Wiki Author: Alice`
  - Distinct Contributor: `Wiki Author: Alice (Created) • Bob (Top Editor)`
- **Full Ingestion & Backfill Lifecycle**:
  1. Generation-time extraction in `wikiLoreCardGenerator`.
  2. JIT resolver on card modal open (`getCardAuthorInfo`) with auto-persistence.
  3. Bulk Backfill Admin mutation in Lore Studio (`backfillWikiAuthors`).

---

## 2. Data Structure & Types

### In `src/types/cards-display.ts` and `src/lib/cards/index.ts`:
```ts
export interface CardAuthorInfo {
  creator: string;                    // e.g. "CaphiriaAuthor"
  createdAt?: string;                 // ISO date of revision 1
  primaryContributor?: string | null; // e.g. "DericaniaEditor" (if different)
  contributorCount?: number;          // total registered contributors
  displayAuthor: string;              // e.g. "CaphiriaAuthor (Created) • DericaniaEditor (Top Editor)"
  isBotFiltered?: boolean;
}
```

Stored inside `Card.metadata` (JSONB) as `metadata.authorInfo`.

---

## 3. MediaWiki Parsing & Extraction Pipeline

### `src/lib/wiki-lore-card-generator.ts`
Implement `fetchArticleAuthorInfoBatch(titles: string[], source: "ixwiki" | "iiwiki"): Promise<Map<string, CardAuthorInfo>>`:
- MediaWiki query:
  ```
  action=query
  &prop=revisions|contributors
  &titles=${titles.join("|")}
  &rvdir=newer
  &rvlimit=5
  &rvprop=user|timestamp|comment
  &pclimit=10
  &format=json
  ```
- **Bot Filter**:
  Regex: `/^(.*bot|mediawiki default|maintenance script|adminimport|importbot)$/i`
  Iterate through the first 5 revisions to locate the first non-bot human author.
- **Primary Contributor**:
  Find the top contributor from `page.contributors` who does not equal `creator`.
- **String Formatter**:
  ```ts
  const displayAuthor = primaryContributor
    ? `${creator} (Created) • ${primaryContributor} (Top Editor)`
    : creator;
  ```

---

## 4. tRPC Endpoints & Admin Tools

### A. Just-In-Time Resolver (`src/server/api/routers/lore-cards/wiki.ts`)
- `getCardAuthorInfo`: publicProcedure taking `{ cardId?: string; articleTitle: string; source: "ixwiki" | "iiwiki" }`
  - Fetches author metadata from MediaWiki if not already cached in `Card.metadata.authorInfo`.
  - If `cardId` is provided, asynchronously writes the resolved `authorInfo` to `card.metadata`.

### B. Bulk Backfill Admin Procedure (`src/server/api/routers/lore-cards/admin.ts`)
- `backfillWikiAuthors`: adminProcedure taking `{ limit?: number; forceAll?: boolean }`
  - Queries lore cards where `metadata.authorInfo` is null.
  - Resolves authors in batches of 50 via `fetchArticleAuthorInfoBatch`.
  - Updates card records and logs `CARD_AUTHORS_BACKFILLED` in `AuditLog`.

---

## 5. UI Integration

### `src/components/cards/display/modal/CardOverviewTab.tsx`
- Formats `wikiAuthor` directly from `card.metadata.authorInfo?.displayAuthor` or live fallback.
- Merged Tier & Season row + Wiki Author row.

### `src/app/admin/cards/LoreCardBatchAdmin.tsx`
- Adds a "Backfill Authors" action button in the Lore Admin Studio.
