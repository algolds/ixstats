# Design Specification: Cards & Vault Optimization & Architecture Refactor

**Date:** 2026-08-17  
**Status:** In Review  
**Audience:** Antigravity / Engineers  
**Methodologies:** `brainstorming`, `typescript-advanced-types`, `typescript-pro`, `ponytail`

---

## 1. Executive Summary

This specification outlines a comprehensive architectural, performance, and type-system optimization of the **Cards and Vault** ecosystem in IxStates.

The initiative achieves four objectives:
1. **Architecture Guardrails**: Eliminates the 997-line router god-file (`src/server/api/routers/cards/inventory.ts`) by cleanly splitting into domain-focused sub-routers ($\le 700$ lines) recombined via `mergeRouters`.
2. **TypeScript Domain Modeling**: Introduces discriminated unions and custom type guards for card instances (`LoreCardInstance | NSCardInstance | NationCardInstance`), eliminating unchecked `any` / `unknown` assertions.
3. **Frontend Rendering Optimization**: Removes redundant static re-computations inside `CardDisplay.tsx`, hoists configuration maps, memoizes visual styling derivations, and optimizes layout transitions for large inventory grids.
4. **Backend Query Optimization**: Eliminates over-fetching in card inventory queries and caches valuation/bonus configurations.

---

## 2. Architecture & Router Decomposition

### Current State
`src/server/api/routers/cards/inventory.ts` is **997 lines** long, housing user inventory queries, card junking mutations, valuation settings, bonus configuration, commons flag ingestion, and admin value recomputations.

### Proposed Sub-Router Breakdown
All sub-routers live in `src/server/api/routers/cards/` and are merged in `index.ts` using `mergeRouters` to preserve 100% of existing `api.cards.*` client call-sites.

| Sub-Router File | Scope & Procedures | Target Line Count |
| :--- | :--- | :--- |
| **`inventory.ts`** | User inventory retrieval & card junking (`getMyCards`, `getUserInventory`, `getJunkableCards`, `getJunkableCardsFast`, `junkCards`, `quickJunkBatch`) | ~320 lines |
| **`settings.ts`** | Vault valuation and bonus configuration (`getCardSettings`, `updateCardSettings`, `getValuationConfig`, `updateValuationConfig`, `getBonusConfig`, `updateBonusConfig`) | ~220 lines |
| **`admin.ts`** | Admin batch actions & Commons flag ingestion (`importCommonsFlags`, `getCommonsFlagImportStatus`, `recomputeCardValues`) | ~220 lines |
| **`browse.ts`** *(existing)* | Public card search, filters, and leaderboards | ~250 lines |
| **`collections.ts`** *(existing)* | Card sets and collector albums | ~145 lines |
| **`operations.ts`** *(existing)* | Trading, auctions, and direct transfers | ~240 lines |
| **`index.ts`** | Merges all sub-routers with `mergeRouters(cardsInventoryRouter, cardsSettingsRouter, cardsAdminRouter, ...)` | ~35 lines |

**Result:** Zero router files exceed 400 lines (well under the 700-line ceiling).

---

## 3. TypeScript Domain Modeling & Advanced Types

### Discriminated Unions for Card Types
Define structured metadata schemas and compose them into a discriminated union:

```typescript
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type CardId = Brand<string, "CardId">;
export type CardOwnershipId = Brand<string, "CardOwnershipId">;

export interface BaseCardInstance {
  id: string;
  title: string;
  description?: string | null;
  artwork?: string | null;
  artworkUrl?: string | null;
  rarity: CardRarity;
  season: number;
  marketValue: number;
  level: number;
  acquiredAt?: Date | string | null;
  isRetired?: boolean;
  serialNumber?: number | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
  attributes?: Record<string, unknown> | null;
}

export interface LoreCardInstance extends BaseCardInstance {
  cardType: "LORE" | "LORE_BATCH";
  wikiSource?: "ixwiki" | "iiwiki";
  wikiArticleTitle?: string | null;
  wikiUrl?: string | null;
  metadata?: LoreCardMetadata | null;
}

export interface NSCardInstance extends BaseCardInstance {
  cardType: "NS_IMPORT";
  nsCardId: number;
  nsSeason: number;
  nsData?: NSCardData | null;
}

export interface NationCardInstance extends BaseCardInstance {
  cardType: "NATION";
  countryId?: string | null;
  country?: { id: string; name: string; flagUrl?: string | null } | null;
}

export type DiscriminatedCardInstance =
  | LoreCardInstance
  | NSCardInstance
  | NationCardInstance;
```

### Type Guards (Predicates)
```typescript
export function isLoreCard(card: BaseCardInstance): card is LoreCardInstance {
  const t = card.cardType as string;
  return t === "LORE" || t === "LORE_BATCH" || Boolean(card.category && card.category !== "NS_IMPORT");
}

export function isNSCard(card: BaseCardInstance): card is NSCardInstance {
  return card.cardType === "NS_IMPORT" && typeof (card as any).nsCardId === "number";
}
```

---

## 4. Frontend Performance Optimization

### Static Hoisting & Memoization in `CardDisplay.tsx`
1. **Hoist Static Lookup Tables**: Move `FONT_SIZES`, `HEIGHT_CLASSES`, and `BORDER_WIDTHS` to module-level constants.
2. **Memoize Expensive Calculations**:
   - `rarityConfig`, `stats`, `borderConfig`, `foilStamp`, and `categoryTheme` wrapped in `useMemo` dependent on `[card.rarity, card.level, card.category, card.stats]`.
3. **Eliminate Runtime Gradient Parsing**:
   - Replace `.gradient.split(" ").map((c) => ...)` with direct CSS variable bindings or memoized gradient strings.
4. **Lightweight Mode on Large Grids**:
   - Ensure `performanceMode` / reduced 3D tilt overhead is applied when rendering lists $> 40$ items in `InventoryTab` and `CardGalleryTab`.

---

## 5. Query & Cache Optimization

1. **Selective Field Projections in `card-service.ts`**:
   - In `getUserCards`, select only required fields for display instead of querying unbounded JSON blobs where unneeded.
2. **In-Memory Config Caching**:
   - Valuation configs and vault bonus configs cached in `globalCache` for 5 minutes with automatic invalidation on update mutations.

---

## 6. Verification Plan

1. **Architecture & Line Counts**:
   ```bash
   wc -l src/server/api/routers/cards/*.ts
   ```
   Verify every file in `src/server/api/routers/cards/` is $\le 700$ lines.
2. **ESLint & Type Safety**:
   ```bash
   bunx eslint src/server/api/routers/cards/*.ts src/components/cards/display/CardDisplay.tsx src/components/vault/sections/cards/*.tsx src/types/cards-display.ts
   ```
3. **Integration Verification**:
   - Verify `api.cards.getMyCards`, `api.cards.getValuationConfig`, `api.cards.junkCards`, and `api.cards.browseCards` function correctly.
