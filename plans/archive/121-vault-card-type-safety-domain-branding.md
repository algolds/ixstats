# Plan 121: Vault and Card Domain Type Safety, Branded Primitives and Prisma Type Cast Removal

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 1775c087..HEAD -- src/types/cards-display.ts src/types/marketplace.ts src/lib/card-service.ts src/lib/vault-service.ts src/lib/auction-service.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `1775c087`, 2026-08-09

## Why this matters

Core data structures in the IxCards and MyVault systems rely heavily on loose `any` types (`artworkVariants: any`, `nsData: any`, `metadata?: any`, `stats: any`) and loose un-branded string primitives (`userId: string`, `cardId: string`). Furthermore, `vault-service.ts` and `auction-service.ts` bypass Prisma type checking using `(db as any)` and `(tx as any)`. Eliminating `any` types and unsafe Prisma casts enforces compile-time safety and prevents accidental ID swapping or un-validated data mutations.

## Current state

- Loose `any` types in domain definitions:
  - `src/types/cards-display.ts:23-43` uses `any` for `artworkVariants`, `nsData`, `metadata`, `enhancements`.
  - `src/types/marketplace.ts:15-31` uses `any` for `artworkVariants`, `nsData`, `stats`, `enhancements`.
  - `src/lib/card-service.ts:16-33` uses `any` in `CardCreationData`.
- Bypassing Prisma type checking:
  - `src/lib/vault-service.ts:569,705,1058` uses `const dbAny = db as any;`.
  - `src/lib/auction-service.ts:181,338` uses `(db as any).cardWatchlist`.

Exemplar type file following standard TypeScript conventions: [src/shared/types/diplomacy.dto.ts](file:///home/jxsig/projects/ixstats/src/shared/types/diplomacy.dto.ts).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `bun install` | exit 0 |
| Typecheck UI | `bun run typecheck:ui` | exit 0, no errors |
| Typecheck Server | `bun run typecheck:server` | exit 0, no errors |
| Single Test | `bun run test -- src/lib/__tests__/vault-service.test.ts` | all tests pass |

## Scope

**In scope** (the only files you should modify):
- `src/types/cards-display.ts`
- `src/types/marketplace.ts`
- `src/lib/card-service.ts`
- `src/lib/vault-service.ts`
- `src/lib/auction-service.ts`

**Out of scope** (do NOT touch, even though they look related):
- `prisma/schema/cards.prisma` (Database schema changes are blocked)
- `src/server/api/root.ts`
- `src/components/cards/**` (UI components out of scope for this plan)

## Git workflow

- Branch: `v2`
- Commit message: `refactor(cards): replace loose any types and dbAny casts with branded types and schema interfaces`

## Steps

### Step 1: Define Branded Domain Primitives and Strongly-Typed Card Interfaces
In `src/types/cards-display.ts` and `src/types/marketplace.ts`:
1. Create nominal branded types:
   ```typescript
   export type Brand<K, T extends string> = K & { readonly __brand: T };
   export type UserId = Brand<string, "UserId">;
   export type CardId = Brand<string, "CardId">;
   export type AuctionId = Brand<string, "AuctionId">;
   export type OwnershipId = Brand<string, "OwnershipId">;
   ```
2. Define structured interfaces to replace `any`:
   ```typescript
   export interface ArtworkVariants {
     holographicUrl?: string;
     foilUrl?: string;
     altArtUrl?: string;
     [key: string]: unknown;
   }

   export interface CardStatsData {
     economic?: number;
     diplomatic?: number;
     military?: number;
     social?: number;
     [statKey: string]: number | undefined;
   }

   export interface CardEnhancementsData {
     level?: number;
     statBoosts?: Record<string, number>;
     customBorder?: string;
     [key: string]: unknown;
   }
   ```
3. Update `CardInstance` in both `src/types/cards-display.ts` and `src/types/marketplace.ts` to use these interfaces instead of `any`.

**Verify**: `bun run typecheck:ui` → Exits 0 with no errors.

### Step 2: Remove `(db as any)` and `(tx as any)` Bypasses in `vault-service.ts` and `auction-service.ts`
1. In `src/lib/vault-service.ts`:
   - Replace `const dbAny = db as any;` at line 569 with standard `db.card.count` / `db.card.findFirst` calls.
   - Replace `await dbAny.cardTransferEvent.create` at line 705 with `await db.cardTransferEvent.create`.
2. In `src/lib/auction-service.ts`:
   - Replace `const dbAny = db as any;` at line 181 with `await db.cardWatchlist.findMany`.

**Verify**: `bun run typecheck:server` → Exits 0 with no errors.

### Step 3: Update `card-service.ts` `CardCreationData` Type Signatures
In `src/lib/card-service.ts`:
- Update `CardCreationData` to use `ArtworkVariants`, `CardStatsData`, `CardEnhancementsData`, and `Record<string, unknown>` instead of `any`.

**Verify**: `bun run test -- src/lib/__tests__/card-service.test.ts` (or `vault-service.test.ts`) → Pass.

## Test plan

- Test type checking on server and ui sub-projects.
- Run `bun run test -- src/lib/__tests__/vault-service.test.ts`.

## Done criteria

- [ ] `bun run typecheck:server` passes without errors.
- [ ] `bun run typecheck:ui` passes without errors.
- [ ] No `(db as any)` casts exist in `vault-service.ts` or `auction-service.ts`.
- [ ] No `artworkVariants: any` or `stats: any` remain in `cards-display.ts` or `marketplace.ts`.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If `db.cardTransferEvent` or `db.cardWatchlist` are missing from the generated Prisma client in `.prisma/client`, stop and report (run `bun run postinstall` or prisma generate).

## Maintenance notes

- Future API endpoints in `src/server/api/routers/cards/` should accept `CardId` and `UserId` branded types.
