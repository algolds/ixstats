# Spec: NationStates Card Valuation & Sync Consolidation

**Date:** 2026-07-20  
**Status:** Brainstormed & Approved  
**Epic:** IxVault Trading Cards Integration

## Goal Description

Currently, the NationStates (NS) trading card value conversion logic is inconsistent across imports, manual deck fetching, periodic background syncs, and manual value refreshes. Additionally, the split routers (`decks.ts`, `sync.ts`, `verification.ts`, and `cards.ts`) contain duplicate copies of core background sync processing helper functions (`processNationDeck` and `processRegionNationsInBackground`), leading to dead code and potential regressions.

This spec details:
1. Extracting active background sync processing to a shared service helper ([ns-sync-processor.ts](file:///home/jxsig/projects/ixstats/src/lib/ns-sync-processor.ts)).
2. Updating the background processor to use the canonical `computeCardValue` from [card-valuation.ts](file:///home/jxsig/projects/ixstats/src/lib/card-valuation.ts) for proper IxCredits conversion.
3. Updating all router value refreshes to use `computeCardValue` as well.
4. Removing duplicate dead helper functions from the split routers to shrink file line counts below the 700-line god-file limit.

## Proposed Changes

### Shared Core Sync Processor

#### [NEW] [ns-sync-processor.ts](file:///home/jxsig/projects/ixstats/src/lib/ns-sync-processor.ts)
A single place containing background processing functions. It will:
* Export `activeRunningJobs: Set<string>`.
* Define and export `processNationDeck(db, nationName, regionName)`:
  - Fetches the nation's deck.
  - Resolves current `CardValuationConfig` via `getValuationConfig(db)`.
  - Determines new card value using `computeCardValue({ rarity, cardType: "NS_IMPORT", nsMarketValue }, valCfg)`.
  - Creates or updates the card in the database.
* Define and export `processRegionNationsInBackground(db, syncLogId, nations, regionName, startFromIndex, initialCounts)`:
  - Iterates through nations in the region.
  - Updates progress in the `SyncLog` after every nation (enabling resume functionality).
  - Handles pauses or cancellation states safely.

---

### Router Cleanup & Integration

#### [MODIFY] [sync.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/ns-import/sync.ts)
* Remove local duplicate definitions of `processNationDeck`, `processRegionNationsInBackground`, and `activeRunningJobs`.
* Import `processRegionNationsInBackground` and `activeRunningJobs` from `~/lib/ns-sync-processor`.

#### [MODIFY] [cards.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/ns-import/cards.ts)
* Remove local duplicate definitions of `processNationDeck` and `processRegionNationsInBackground`.
* Update `refreshCardValues` to utilize `computeCardValue` instead of `Math.max(1, parseFloat(info.market_value))`.

#### [MODIFY] [decks.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/ns-import/decks.ts)
* Remove local duplicate definitions of `processNationDeck` and `processRegionNationsInBackground`.
* This shrinks the file by ~245 lines, dropping it below the 700-line ceiling.

#### [MODIFY] [verification.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/ns-import/verification.ts)
* Remove local duplicate definitions of `processNationDeck` and `processRegionNationsInBackground`.

---

## Verification Plan

### Automated Tests
- Run typecheck check: `bun run typecheck:server` to verify no TypeScript compilation issues.
- We will add a unit test or use existing test suites to check compilation safety.

### Manual Verification
- Verify that `refreshCardValues` properly calculates values under the valuation config curve.
- Ensure the dev server runs successfully: `bun run dev`.
