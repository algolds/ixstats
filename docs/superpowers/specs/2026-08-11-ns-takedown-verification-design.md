# NationStates Card Takedown & Ownership Verification Design

## Overview

This spec defines the self-service NationStates card takedown system. Flag owners on NationStates can verify their nation ownership using the official NationStates Verification API (`a=verify`) and automatically retire card artwork for their nation.

## User Experience & Flow

### 1. Card Footer Message & Action Trigger (`NationStatesAttribution.tsx` & `CardDetailsModal.tsx`)
- **Attribution Footer Text:**
  Updated attribution message includes an explicit self-service takedown trigger:
  > *"Trading card data provided via official [NationStates API](https://www.nationstates.net/pages/api.html#cards). Not affiliated with or endorsed by NationStates. All artwork, flags, and logos remain copyright of their respective owners. **Flag owner? [Verify on NS to request takedown](#)**"*
- **Action Button in Card Modal (`CardDetailsModal.tsx`):**
  When rendering an `NS_IMPORT` card, a small **"Request Takedown"** button with a shield/flag icon is displayed next to the attribution footer.

### 2. Verification Dialog (`CardTakedownVerificationModal.tsx`)
- **Modal Content:**
  - Displays target card title, card ID, season, and flag preview.
  - Direct link to `https://www.nationstates.net/page=verify_login` where logged-in nation owners generate a temporary verification checksum code.
  - **Inputs:**
    - `nationName` (string): Pre-filled with the nation name associated with the card.
    - `checksum` (string): Checksum code generated on NationStates.
    - `reason` (optional string): Optional takedown note.
  - **Action:** Clicking **"Verify Ownership & Remove Artwork"** triggers the backend verification procedure.

### 3. Backend Verification Procedure (`cards.ts`)
- **Procedure (`requestSelfServiceTakedown`):**
  - Input schema: `{ cardId: z.string(), nationName: z.string(), checksum: z.string(), reason: z.string().optional() }`.
  - Calls `nsApiClient.verifyOwnership(input.nationName, input.checksum)`.
  - Validates that the verified nation matches the nation associated with the card (e.g. `card.title` or `card.stats.region`/metadata).
  - Updates card row:
    - `isRetired: true`
    - `retiredAt: new Date()`
    - `artwork: null`
    - `artworkVariants: Prisma.DbNull`
    - Metadata updated with `nsTakedown: { selfService: true, verifiedNation: input.nationName, timestamp, reason }`.
  - Invalidates tRPC card queries (`cards.getUserCards`, `cards.getNSCards`, `cards.getCardDetails`) so card artwork is removed across the site immediately.

## Data Schema & Persistence

No database schema migrations are required. The existing `Card` model fields (`isRetired`, `retiredAt`, `artwork`, `metadata`) support takedowns natively. Audit records are stored within `card.metadata.nsTakedown`.

## Verification Plan

- **Automated Verification:**
  - `bun run typecheck:ui` to verify clean TypeScript compilation across component and router files.
- **Manual Verification:**
  - Open `CardDetailsModal` for an imported NS card.
  - Click the **"Request Takedown"** link/button in the footer.
  - Test verification modal inputs and error handling for invalid checksums.
